import { injectable } from "inversify";
import { Response } from "lambda-api";
import { body, header, produces, queryParam, rawBody, response, GET, POST, Controller } from "ts-lambda-api";

import { Message } from "./Message";

@injectable()
export class EchoController extends Controller {
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
    public echo(@body message: Message, @response response: Response): Message {
        response.status(201)

        return message
    }

    @POST("/echo-body")
    public echoBody(@body message: any): Message {
        return message
    }

    @produces("application/octet-stream")
    @POST("/echo-binary-body")
    public echoBinaryBody(@rawBody body: Buffer, @header("content-type") contentType: string) {
        this.response
            .header("content-type", contentType)
            .sendFile(body)
    }
}
