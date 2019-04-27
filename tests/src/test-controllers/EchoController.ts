import * as path from "path"

import { injectable } from "inversify";
import { Response } from "lambda-api";
import { fromBody, header, produces, queryParam, response, GET, POST, Controller } from "ts-lambda-api";

import { Message } from "./Message";

@injectable()
export class EchoController extends Controller {
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

    @POST("/echo-body")
    public echoBody(@fromBody message: any): Message {
        return message
    }

    @produces("application/octet-stream")
    @POST("/echo-binary-body")
    public echoBinaryBody(@header("content-type") contentType: string) {
        this.response
            .header("content-type", contentType)
            .sendFile(Buffer.from(this.request.rawBody, 'base64'))
    }
}
