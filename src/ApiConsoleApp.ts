import commandLineArgs, { OptionDefinition } from "command-line-args"
import { NextFunction } from "connect"
import cors from "cors"
import express, { Request, Response, Application } from "express"
import { Server } from "http"
import { Container } from "inversify"
import { serve as serveSwaggerUi, setup as setupSwaggerUi } from "swagger-ui-express"

import { ApiApp, ApiRequest, ApiResponse, timed, AppConfig  } from "typescript-lambda-api"

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
    private static readonly APP_OPTIONS: OptionDefinition[] = [
        { name: "port", alias: "p", type: Number, defaultValue: 8080 },
        { name: "host", alias: "h", type: String, defaultValue: "*" },
        { name: "cors-origin", alias: "c", type: String, defaultValue: "*" }
    ]

    protected readonly expressApp: Application

    private server?: Server

    public constructor(controllersPath: string, appConfig?: AppConfig, appContainer?: Container) {
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
        let self = this
        let options = this.parseArguments(args)
        let listenOnAllHosts = options.host === "*"
        let baseUrl = `http://${options.host}:${options.port}`

        this.logger.debug("Server base URL: %s", baseUrl)

        await super.initialiseControllers()

        this.logger.debug("CORS origin set to: %s", options["cors-origin"])

        this.expressApp.use(cors({
            origin: options["cors-origin"]
        }))

        if (this.appConfig.openApi.enabled) {
            this.configureSwaggerUi(baseUrl)
        }

        this.expressApp.all(
            "*",
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

            let apiRequestEvent = await self.mapRequestToApiEvent(request)
            let apiResponse = await self.run(apiRequestEvent, {})

            self.forwardApiResponse(apiResponse, response)
        } catch (ex) {
            onError(ex)
        }
    }

    private async mapRequestToApiEvent(request: Request): Promise<ApiRequest> {
        let apiRequest = new ApiRequest()

        apiRequest.httpMethod = request.method
        apiRequest.path = request.path

        Object.keys(request.headers)
            .forEach(h => apiRequest.headers[h] = request.headers[h])
        Object.keys(request.query)
            .forEach(q => apiRequest.queryStringParameters[q] = request.query[q])

        // read request body (if any) as a base 64 string
        return await new Promise<ApiRequest>((resolve, reject) => {
            this.logger.debug("Reading request body as base64 string")

            let body = ""

            request.setEncoding("base64")

            request.on("data", d => body += d)
            request.on("end", () => {
                apiRequest.body = body
                apiRequest.isBase64Encoded = true

                resolve(apiRequest)
            })
            request.on("error", reject)
        })
    }

    private forwardApiResponse(apiResponse: ApiResponse, response: Response) {
        this.logger.debug("Mapping AWS response model to express response")

        let headers = apiResponse.headers

        response.status(apiResponse.statusCode)
        Object.keys(headers).forEach(h => response.header(h, headers[h]))

        let body: any = apiResponse.body

        if (apiResponse.isBase64Encoded) {
            body = Buffer.from(body, "base64")
        }

        response.send(body)
    }
}
