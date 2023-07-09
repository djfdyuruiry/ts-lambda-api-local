import { raw as rawBodyParser } from "body-parser"
import commandLineArgs, { OptionDefinition } from "command-line-args"
import { NextFunction } from "connect"
import cors from "cors"
import express, { Request, Response, Application } from "express"
import { Server } from "http"
import { Container } from "inversify"
import { serve as serveSwaggerUi, setup as setupSwaggerUi } from "swagger-ui-express"

import { ApiApp, ApiRequest, ApiResponse, timed, AppConfig, LogLevel  } from "ts-lambda-api"

/**
 * Simple console application that hosts an express HTTP
 * server.
 *
 * A request is mapped from the HTTP request to the ApiServer
 * event format, a ApiServer instance then processes the request.
 * The ApiServer response is mapped to a standard HTTP response and
 * returned to the express client.
 */
export class ApiConsoleApp extends ApiApp {
    private static readonly MAX_REQUEST_BODY_SIZE = "10000kb"
    private static readonly HTTP_METHODS_WITH_ENTITY = ["POST", "PUT", "PATCH"]
    private static readonly APP_OPTIONS: OptionDefinition[] = [
        { name: "port", alias: "p", type: Number, defaultValue: 8080 },
        { name: "host", alias: "h", type: String, defaultValue: "*" },
        { name: "cors-origin", alias: "c", type: String, defaultValue: "*" }
    ]

    protected readonly expressApp: Application

    private server?: Server

    /**
     * Builds an new console app.
     *
     * If a value for`appConfig` is not passed, the `serverLogger`
     * property is missing or the `serverLogger.logTimestamp` property
     * is missing timestamps will be enabled for logger output.
     */
    public constructor(controllersPath: string[], appConfig?: AppConfig, appContainer?: Container) {
        if (!appConfig) {
            appConfig = new AppConfig()
        }

        if (!appConfig.serverLogger) {
            appConfig.serverLogger = {
                format: "string",
                level: LogLevel.info,
                logTimestamp: true
            }
        }

        if (appConfig.serverLogger.logTimestamp === null ||
            appConfig.serverLogger.logTimestamp === undefined) {
            appConfig.serverLogger.logTimestamp = true
        }

        super(controllersPath, appConfig, appContainer)

        this.logger = this.logFactory.getLogger(ApiConsoleApp)
        this.expressApp = express()
    }

    @timed
    public async run(request: ApiRequest, context: any) {
        return await this.apiServer.processEvent(request, context)
    }

    /**
     * Starts the express server.
     *
     * @param args Command line arguments for this server, see --help for more info.
     */
    public async runServer(args: string[]) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let self = this
        let options = this.parseArguments(args)
        let listenOnAllHosts = options.host === "*"
        let baseUrl = `http://${options.host as string}:${options.port as number}`

        this.logger.debug("Server base URL: %s", baseUrl)

        await super.initialiseControllers()

        this.configureServer(baseUrl, options)

        this.expressApp.all(
            "*",
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            (req, res, next) => self.handleHttpRequest(self, req, res, next)
        )

        this.server = await new Promise<Server> ((resolve, reject) => {
            try {
                if (listenOnAllHosts) {
                    this.logger.debug("Listening on all hosts")

                    let server = this.expressApp.listen(options.port, () => resolve(server))
                } else {
                    this.logger.debug("Listening on host: %s", options.host)

                    let server = this.expressApp.listen(
                        options.port,
                        options.host,
                        () => resolve(server)
                    )
                }
            } catch (ex) {
                reject(ex)
            }
        })

        this.logger.info(`Listening for HTTP requests on ${baseUrl} ...`)
    }

    private configureServer(baseUrl: string, options: any) {
        // setup CORS
        this.expressApp.use(cors({
            origin: options["cors-origin"]
        }))

        this.logger.debug("CORS origin set to: %s", options["cors-origin"])

        // setup body parser to Base64 encode request's
        this.expressApp.use(rawBodyParser({
            limit: ApiConsoleApp.MAX_REQUEST_BODY_SIZE,
            type: () => true
        }))

        this.logger.warn(
            "To simulate an AWS ALB or Application Gateway the max size for requests is limited to %s",
            ApiConsoleApp.MAX_REQUEST_BODY_SIZE
        )

        // setup SwaggerUI
        if (this.appConfig.openApi.enabled) {
            this.configureSwaggerUi(baseUrl)
        }
    }

    private configureSwaggerUi(baseUrl: string) {
        let basePath = this.appConfig.base || ""
        let specUrl = `${basePath}/open-api.json`
        let swaggerUiUrl = `${basePath}/swagger`

        this.logger.info("OpenAPI enabled, configuring SwaggerUI to be available @ %s%s",
            baseUrl, swaggerUiUrl)

        this.expressApp.use(
            swaggerUiUrl,
            serveSwaggerUi,
            setupSwaggerUi(null, {
                explorer : true,
                swaggerUrl: specUrl
            })
        )
    }

    public async stopServer() {
        if (!this.server) {
            throw new Error("stopServer can only be called after runServer has been called and has completed")
        }

        this.logger.info("Server shutting down")

        await new Promise<void>((resolve, reject) => {
            try {
                this.server.close(() => resolve())
            } catch (ex) {
                reject(ex)
            }
        })
    }

    private parseArguments(args: string[]) {
        this.logger.trace("Command line arguments: %s", args)

        return commandLineArgs(ApiConsoleApp.APP_OPTIONS, {
            argv: args
        })
    }

    @timed
    private async handleHttpRequest(self: ApiConsoleApp, request: Request, response: Response, onError: NextFunction) {
        try {
            this.logger.debug("Mapping express request to AWS model")

            let apiRequestEvent = self.mapRequestToApiEvent(request)
            let apiResponse = await self.run(apiRequestEvent, {})

            self.forwardApiResponse(apiResponse, response)
        } catch (ex) {
            onError(ex)
        }
    }

    private mapRequestToApiEvent(request: Request): ApiRequest {
        let apiRequest = new ApiRequest()

        apiRequest.httpMethod = request.method
        apiRequest.path = request.path

        Object.keys(request.headers)
            .forEach(h => apiRequest.headers[h] = request.headers[h])
        Object.keys(request.query)
            .forEach(q => apiRequest.queryStringParameters[q] = request.query[q])

        if (!ApiConsoleApp.HTTP_METHODS_WITH_ENTITY.includes(request.method)) {
            // request HTTP method does not include a body
            return apiRequest
        }

        // read request body as a base64 string
        this.logger.debug("Reading request body as base64 string")

        let body = request.body as Buffer

        apiRequest.body = body.toString("base64")
        apiRequest.isBase64Encoded = true

        return apiRequest
    }

    private forwardApiResponse(apiResponse: ApiResponse, response: Response) {
        this.logger.debug("Mapping AWS response model to express response")

        let headers = apiResponse.headers

        response.status(apiResponse.statusCode)
        Object.keys(headers).forEach(h => response.header(h, headers[h]))

        if (apiResponse.isBase64Encoded) {
            response.contentType(
                apiResponse.headers["content-type"] || "application/octet-stream"
            )

            response.end(
                Buffer.from(apiResponse.body, "base64")
            )
        } else {
            response.send(apiResponse.body)
        }
    }
}
