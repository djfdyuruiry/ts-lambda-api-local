import * as fs from "fs"
import * as path from "path"
import * as temp from "temp"

import { AsyncTest, AsyncSetup, AsyncTeardown, Expect, TestFixture, TestCase } from "alsatian"
import { sync as calculateFileMd5Sync } from "md5-file"
import { RestClient } from "typed-rest-client"
import { BasicCredentialHandler } from "typed-rest-client/Handlers"
import { HttpClient } from "typed-rest-client/HttpClient"
import { IHttpClientResponse } from "typed-rest-client/Interfaces";

import { ApiConsoleApp } from "../../dist/ts-lambda-api-local"

import { Message } from "./test-controllers/Message"
import { TestAuthFilter } from "./test-components/TestAuthFilter"
import { AppConfig } from "ts-lambda-api";

@TestFixture()
export class ConsoleAcceptanceTests {
    private static readonly BASE_URL = "http://localhost:8080"
    private static readonly TEST_FILE_PATH = path.join(__dirname, "../test.pdf")
    private static readonly TEST_FILE_SIZE = 19605
    private static readonly TEST_FILE_MD5 = "bb0cf6ccd0fe8e18e0a14e8028709abe"

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
    public async when_valid_http_post_json_request_sent_then_app_returns_response_body_and_201_created() {
        let message: Message = { text: "hello there" }
        let response = await this.restClient.create<Message>("/echo", message)

        Expect(response.statusCode).toBe(201)
        Expect(response.result).toEqual(message)
    }

    @AsyncTest()
    public async when_valid_http_post_request_sent_then_app_returns_response_body_and_200_ok() {
        let body = "I am the body of the POST request, so I am"
        let response = await this.httpClient.post(
            `${ConsoleAcceptanceTests.BASE_URL}/echo-body`,
            body
        )

        Expect(response.message.statusCode).toEqual(200)
        Expect(await response.readBody()).toEqual(body)
    }

    @AsyncTest()
    public async when_valid_http_get_request_sent_then_app_returns_binary_response_body_and_200_ok() {
        let response: IHttpClientResponse
        let testFileStream = fs.createReadStream(ConsoleAcceptanceTests.TEST_FILE_PATH)

        try {
            response = await this.httpClient.sendStream(
                "POST",
                `${ConsoleAcceptanceTests.BASE_URL}/echo-binary-body`,
                testFileStream,
                {
                    "content-type": "application/pdf"
                }
            )
        } finally {
            testFileStream.close()
        }

        let outputFile = temp.openSync()
        let outputStream = fs.createWriteStream(null, { fd: outputFile.fd })

        try {
            response.message.pipe(outputStream)
            await new Promise(r => response.message.on("end", r))
        } finally {
            outputStream.close()
        }

        Expect(response.message.statusCode).toEqual(200)

        Expect(
            fs.statSync(outputFile.path).size
        ).toBe(
            ConsoleAcceptanceTests.TEST_FILE_SIZE
        )

        Expect(
            calculateFileMd5Sync(outputFile.path)
        ).toBe(
            ConsoleAcceptanceTests.TEST_FILE_MD5
        )
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

    @AsyncTest()
    @TestCase(true)
    @TestCase(false)
    public async when_log_timestamps_is_configured_then_app_builds_without_exception(value: boolean) {
        this.appConfig = new AppConfig()

        this.appConfig.serverLogger.logTimestamp = value

        await this.buildApp()
    }

    @AsyncTest()
    @TestCase(null)
    @TestCase(undefined)
    public async when_server_logger_is_missing_then_app_builds_without_exception(value: any) {
        this.appConfig = new AppConfig()

        this.appConfig.serverLogger = value

        await this.buildApp()
    }


    @AsyncTest()
    @TestCase(null)
    @TestCase(undefined)
    public async when_config_is_missing_then_app_builds_without_exception(value: any) {
        this.appConfig = value

        await this.buildApp()
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
