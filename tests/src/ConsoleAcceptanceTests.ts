import * as path from "path"

import { Expect, TestFixture, AsyncTest, AsyncSetup, AsyncTeardown } from "alsatian"
import { RestClient } from "typed-rest-client"

import { ApiConsoleApp } from "../../index"

@TestFixture()
export class ConsoleAcceptanceTests {
    private app: ApiConsoleApp 
    private client: RestClient

    @AsyncSetup
    public async setup() {
        this.app = new ApiConsoleApp(
            path.join(__dirname, "test-controllers")
        )
        this.client = new RestClient("alsatian tests", "http://localhost:5555")

        await this.app.runServer([])
    }

    @AsyncTeardown
    public async teardown() {
        await this.app.stopServer()
    }

    @AsyncTest()
    public async when_runServer_is_called_then_app_responds_to_valid_http_get_request() {
        let response = await this.client.get<String>("/")

        Expect(response.result).toBe(new String("hello"))
        Expect(response.statusCode).toBe(200)
    }
}
