import * as fs from "fs"
import * as path from "path"

import { Expect, TestFixture, AsyncTest, AsyncSetup, AsyncTeardown } from "alsatian"
import "temp"
import { RestClient } from "typed-rest-client"
import { HttpClient } from "typed-rest-client/HttpClient"

import { ApiConsoleApp } from "../../index"

import { Message } from "./test-controllers/Message";
import temp = require("temp");

@TestFixture()
export class ConsoleAcceptanceTests {
    private static readonly BASE_URL = "http://localhost:5555"
    private static readonly TEST_FILE_SIZE = 19605

    private app: ApiConsoleApp 
    private restClient: RestClient
    private httpClient: HttpClient

    @AsyncSetup
    public async setup() {
        this.app = new ApiConsoleApp(
            path.join(__dirname, "test-controllers")
        )
        
        this.restClient = new RestClient("alsatian tests", ConsoleAcceptanceTests.BASE_URL)
        this.httpClient = this.restClient.client

        await this.app.runServer([])
    }

    @AsyncTeardown
    public async teardown() {
        await this.app.stopServer()
    }

    @AsyncTest()
    public async when_valid_http_get_request_sent_console_app_returns_response_body_and_200_ok() {
        let response = await this.restClient.get<Message>("/")

        Expect(response.statusCode).toBe(200)
        Expect(response.result.text).toBe("hello")
    }

    @AsyncTest()
    public async when_valid_http_post_request_sent_console_app_returns_response_body_and_201_created() {
        let message: Message = { text: "hello there" }
        let response = await this.restClient.create<Message>("/echo", message)

        Expect(response.statusCode).toBe(201)
        Expect(response.result).toEqual(message)
    }

    @AsyncTest()
    public async when_valid_http_get_request_sent_console_app_returns_binary_response_body_and_200_ok() {
        let response = await this.httpClient.get(`${ConsoleAcceptanceTests.BASE_URL}/binary`)
        let outputFile = temp.openSync()

        response.message.pipe(
            fs.createWriteStream(null, { fd: outputFile.fd })
        )

        await new Promise((res) => response.message.on("end", res))

        let fileStat = fs.statSync(outputFile.path)

        Expect(fileStat.size).toBe(ConsoleAcceptanceTests.TEST_FILE_SIZE)
    }
}
