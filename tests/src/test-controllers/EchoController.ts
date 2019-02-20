import { GET, produces } from "typescript-lambda-api";

export class EchoController {
    @GET("/")
    @produces("plain/text")
    public sayHello() {
        return "hello"
    }
}