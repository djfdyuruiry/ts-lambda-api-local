import * as path from "path"

import { AppConfig, LogLevel } from "ts-lambda-api"

import { ApiConsoleApp } from "../../../dist/ts-lambda-api-local"

let appConfig = new AppConfig()

appConfig.openApi.enabled = true
appConfig.serverLogger.level = LogLevel.trace

let app = new ApiConsoleApp(
    [ path.join(__dirname, "../test-controllers") ],
    appConfig
)

app.runServer([])
