import { Principal } from "typescript-lambda-api"

export class TestPrincipal extends Principal {
    public constructor() {
        super("dummy")
    }
}
