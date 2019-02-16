import commandLineArgs, { OptionDefinition } from "command-line-args"
import { NextFunction } from "connect"
import express, { Request, Response, Application } from "express"
import { Container } from "inversify"

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
        { name: 'port', alias: 'p', type: Number, defaultValue: 5555 },
        { name: 'host', alias: 'h', type: String, defaultValue: "127.0.0.1" }
    ]

    protected readonly controllersPath: string
    protected readonly expressApp: Application

    public constructor(controllersPath: string, appConfig?: AppConfig, appContainer?: Container) {
        super(appConfig, appContainer)

        this.controllersPath = controllersPath
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

        await super.initialiseControllers(this.controllersPath)

        this.expressApp.all(
            "*",
            (req, res, next) => self.handleHttpRequest(self, req, res, next)
        )

        this.expressApp.listen(options.port, options.host,
            () => {
                console.log(
                    `App is now listening for HTTP requests on http://${options.host}:${options.port} ...`
                )
            })
    }

    private parseArguments(args: string[]) {
        return commandLineArgs(ApiConsoleApp.APP_OPTIONS, {
            argv: args
        })
    }

    @timed
    private async handleHttpRequest(self: ApiConsoleApp, request: Request, response: Response, onError: NextFunction) {
        try {
            let apiRequestEvent = await self.mapRequestToApiEvent(request)
            let apiResponse = await self.run(apiRequestEvent, {})

            self.forwardApiResponse(apiResponse, response)
        } catch (e) {
            onError(e)
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
        return await new Promise((resolve, reject) => {
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
        let headers = apiResponse.headers

        response.status(apiResponse.statusCode)
        Object.keys(headers).forEach(h => response.header(h, headers[h]))

        let body: any = apiResponse.body

        if (apiResponse.isBase64Encoded) {
            body = Buffer.from(body, 'base64')
        }

        response.send(body)
    }
}
