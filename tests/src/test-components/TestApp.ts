import * as path from "path"

import { AppConfig } from "typescript-lambda-api"

import { ApiConsoleApp } from "../../../dist/typescript-lambda-api-local"

let appConfig = new AppConfig()

appConfig.openApi.enabled = true

let app = new ApiConsoleApp(
    path.join(__dirname, "../test-controllers"),
    appConfig
)

app.runServer([])
