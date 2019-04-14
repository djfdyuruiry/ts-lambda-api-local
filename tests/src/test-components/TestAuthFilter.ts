import { BasicAuth, BasicAuthFilter } from "typescript-lambda-api"
import { TestPrincipal } from './TestPrincipal';

export class TestAuthFilter extends BasicAuthFilter<TestPrincipal> {
    public async authenticate(basicAuth: BasicAuth): Promise<TestPrincipal> {
        if (basicAuth.username === "user" && basicAuth.password === "pass") {
            return new TestPrincipal()
        }
    }
}
