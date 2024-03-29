# ts-lambda-api-local

Extension module for the `ts-lambda-api` package which enables running lambda REST API's locally using express.

This module also provides Swagger UI support, powered by the `swagger-ui-express` npm package.

[NPM Package](https://www.npmjs.com/package/ts-lambda-api-local)
[GitHub Repo](https://github.com/djfdyuruiry/ts-lambda-api-local/)

Read the full `typedoc` documentation: https://djfdyuruiry.github.io/ts-lambda-api-local/

---

## Getting Started

---

**Note: These steps modify an existing `ts-lambda-api` app. If you don't have one, see the package documentation.**

- Install this package and types for Node.js as dev dependencies:

```shell
npm install -D ts-lambda-api-local
npm install -D @types/node
```

- Create a new typescript file, add the following:
```typescript
import * as path from 'path'
import { AppConfig } from 'ts-lambda-api'

import { ApiConsoleApp } from 'ts-lambda-api-local'

const appConfig = new AppConfig()

appConfig.base = '/api/v1'
appConfig.version = 'v1'

// if you use a different directory, point to it here instead of 'controllers'
const controllersPath = [path.join(__dirname, 'controllers')]
let app = new ApiConsoleApp(controllersPath, appConfig)

app.runServer(process.argv)
```

- Compile your application and run the new JS file using Node.js

- You can now call your API locally:

```
wget -qO - http://localhost:8080/api/v1/hello-world/
```

----

# Command Line Arguments

----

`ApiConsoleApp` supports several optional command line parameters.

- `-p` or `--port`: Port to listen on, defaults to `8080`
- `-h` or `--host`: Host to accept requests on, defaults to `*` (any hostname/ip)
- `-c` or `--cors-origin`: CORS origins to allow, defaults to `*` (any origin)

----

# Configuration

----

Both the `configureApp` and `configureApi` methods documented in `ts-lambda-api` are available in the `ApiConsoleApp` class.

----

# Swagger UI

----

To enable the Swagger UI page, simply enable open-api in your application config. The interface will then be available from the `/swagger` endpoint. For example, if you configured your app like below:

```typescript
import * as path from 'path'
import { AppConfig } from 'ts-lambda-api'

import { ApiConsoleApp } from 'ts-lambda-api-local'

const appConfig = new AppConfig()

appConfig.base = '/api/v1'
appConfig.version = 'v1'
appConfig.openApi.enabled = true

// if you use a different directory, point to it here instead of 'controllers'
const controllersPath = [path.join(__dirname, 'controllers')]
let app = new ApiConsoleApp(controllersPath, appConfig)

app.runServer(process.argv)
```

Then, the Swagger UI interface will be available @ http://localhost:8080/api/v1/swagger

----

# Packaging for Release

----

When you are packing up your lambda API for release to AWS, ensure that you have installed this package as a development dependency only, otherwise it will significantly slow down and bloat your lambda.
