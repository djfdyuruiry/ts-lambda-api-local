import * as fs from "fs"
import * as path from "path"
import * as temp from "temp"

import { Expect, TestFixture, AsyncTest, AsyncSetup, AsyncTeardown, TestCase } from "alsatian"
import { RestClient } from "typed-rest-client"
import { BasicCredentialHandler } from "typed-rest-client/Handlers"
import { HttpClient } from "typed-rest-client/HttpClient"

import { ApiConsoleApp } from "../../dist/typescript-lambda-api-local"

import { Message } from "./test-controllers/Message"
import { TestAuthFilter } from './test-components/TestAuthFiler';
import { AppConfig } from "typescript-lambda-api";

@TestFixture()
export class ConsoleAcceptanceTests {
    private static readonly BASE_URL = "http://localhost:5555"
    private static readonly TEST_FILE_SIZE = 19605

    private appArgs: string[]
    private app: ApiConsoleApp
    private appConfig: AppConfig
    private restClient: RestClient
    private httpClient: HttpClient

    @AsyncSetup
    public async setup() {
        this.restClient = new RestClient(
            "alsatian tests",
            ConsoleAcceptanceTests.BASE_URL,
            null,
            { allowRedirects: false }
        )
        this.httpClient = this.restClient.client

        this.appArgs = []

        await this.buildApp()
    }

    @AsyncTeardown
    public async teardown() {
        await this.app.stopServer()
    }

    @AsyncTest()
    public async when_valid_http_get_request_sent_then_app_returns_response_body_and_200_ok() {
        let response = await this.restClient.get<Message>("/")

        Expect(response.statusCode).toBe(200)
        Expect(response.result.text).toBe("hello")
    }

    @AsyncTest()
    public async when_valid_http_post_request_sent_then_app_returns_response_body_and_201_created() {
        let message: Message = { text: "hello there" }
        let response = await this.restClient.create<Message>("/echo", message)

        Expect(response.statusCode).toBe(201)
        Expect(response.result).toEqual(message)
    }

    @AsyncTest()
    public async when_valid_http_get_request_sent_then_app_returns_binary_response_body_and_200_ok() {
        let response = await this.httpClient.get(`${ConsoleAcceptanceTests.BASE_URL}/binary`)
        let outputFile = temp.openSync()

        response.message.pipe(
            fs.createWriteStream(null, { fd: outputFile.fd })
        )

        await new Promise((res) => response.message.on("end", res))

        let fileStat = fs.statSync(outputFile.path)

        Expect(fileStat.size).toBe(ConsoleAcceptanceTests.TEST_FILE_SIZE)
    }

    @AsyncTest()
    public async when_valid_http_get_request_with_query_param_sent_then_app_passes_param_to_endpoint() {
        let response = await this.restClient.get<Message>("/query?message=hello from query")

        Expect(response.statusCode).toBe(200)
        Expect(response.result.text).toBe("hello from query")
    }

    @AsyncTest()
    public async when_app_has_basic_auth_configured_and_request_received_with_correct_credentials_then_app_returns_200_ok() {
        await this.buildApp(app =>
            app.middlewareRegistry.addAuthFilter(new TestAuthFilter())
        )

        this.httpClient.handlers.push(
            new BasicCredentialHandler("user", "pass")
        )

        let response = await this.restClient.get<Message>("/")

        Expect(response.statusCode).toBe(200)
    }

    @AsyncTest()
    public async when_app_has_basic_auth_configured_and_request_received_with_incorrect_credentials_then_app_returns_401_unauthorized() {
        await this.buildApp(app =>
            app.middlewareRegistry.addAuthFilter(new TestAuthFilter())
        )

        this.httpClient.handlers.push(
            new BasicCredentialHandler("long", "walk")
        )

        await Expect(async () => await this.restClient.get<Message>("/"))
            .toThrowErrorAsync(Error, "Failed request: (401)")
    }

    @AsyncTest()
    public async when_app_has_basic_auth_configured_and_request_received_without_credentials_then_app_returns_401_unauthorized() {
        await this.buildApp(app =>
            app.middlewareRegistry.addAuthFilter(new TestAuthFilter())
        )

        await Expect(async () => await this.restClient.get<Message>("/"))
            .toThrowErrorAsync(Error, "Failed request: (401)")
    }

    @TestCase("--port")
    @TestCase("-p")
    @AsyncTest()
    public async when_port_set_in_app_args_then_app_listens_on_given_port(portFlag: string) {
        this.appArgs = [portFlag, "3669"]

        await this.buildApp()

        let response = await this.httpClient.get("http://localhost:3669/")

        Expect(response.message.statusCode).toBe(200)
    }

    @AsyncTest()
    public async when_openapi_is_enabled_then_app_serves_swagger_ui() {
        this.appConfig = new AppConfig()
        this.appConfig.openApi.enabled = true

        await this.buildApp()

        let swaggerUrl = `${ConsoleAcceptanceTests.BASE_URL}/swagger/`

        let response = await this.httpClient.get(swaggerUrl)
        let responseBody = await response.readBody()

        Expect(response.message.statusCode).toBe(200)
        Expect(responseBody).toContain(`<div id="swagger-ui"></div>`)
    }

    private async buildApp(configBlock?: (app: ApiConsoleApp) => void) {
        if (this.app) {
            await this.app.stopServer()
        }

        this.app = new ApiConsoleApp(
            path.join(__dirname, "test-controllers"),
            this.appConfig
        )

        if (configBlock) {
            configBlock(this.app)
        }

        await this.app.runServer(this.appArgs)
    }
}
