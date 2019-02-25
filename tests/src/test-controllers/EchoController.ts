import * as path from "path"

import { injectable } from "inversify";
import { Response } from "lambda-api";
import { fromBody, queryParam, response, GET, POST  } from "typescript-lambda-api";

import { Message } from "./Message";

@injectable()
export class EchoController {
    private static readonly TEST_FILE_PATH = path.join(__dirname, "../../test.pdf")

    @GET("/")
    public sayHello(): Message {
        return {
            text: "hello"
        }
    }

    @GET("/query")
    public sayQuery(@queryParam("message") message: string): Message {
        return {
            text: message
        }
    }

    @POST("/echo")
    public echo(@fromBody message: Message, @response response: Response): Message {
        response.status(201)

        return message
    }

    @GET("/binary")
    public getFile(@response response: Response) {
        response.sendFile(EchoController.TEST_FILE_PATH)
    }
}
