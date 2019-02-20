import * as path from "path"

import { injectable } from "inversify";
import { GET, POST, fromBody, response  } from "typescript-lambda-api";

import { Message } from "./Message";
import { Response } from "lambda-api";

@injectable()
export class EchoController {
    private static readonly TEST_FILE_PATH = path.join(__dirname, "../../test.pdf")

    @GET("/")
    public sayHello(): Message {
        return {
            text: "hello"
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
