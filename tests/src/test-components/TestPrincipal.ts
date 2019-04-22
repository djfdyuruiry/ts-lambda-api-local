import { Principal } from "ts-lambda-api"

export class TestPrincipal extends Principal {
    public constructor() {
        super("dummy")
    }
}
