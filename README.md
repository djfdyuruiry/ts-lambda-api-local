# typescript-lambda-api-local

Extension module for the `typescript-lambda-api` package which enables running lambda REST API's locally using express.

---

## Getting Started

---

**Note: These steps modify an existing `typescript-lambda-api` app. If you don't have one, see the package documentation.**

- Install this package and types for Node.js as dev dependencies:

```shell
npm install -D typescript-lambda-api-local
npm install -D @types/node
```

- Create a new typescript file, add the following:

```typescript
import * as path from "path"

import { ApiConsoleApp } from "typescript-lambda-api-local"

// if you use a different directory, point to it here instead of 'controllers'
let app = new ApiConsoleApp(path.join(__dirname, "controllers"))

app.runServer(process.argv)
```

- Compile your application and run the new JS file using Node.js

- You can now call your API locally:

```
wget -qO - http://localhost:5555/api/v1/some-controller/
```

----

# Configuration

----

Both the `configureApp` and `configureApi` methods documented in `typescript-lambda-api` are available in the `ApiConsoleApp` class.

----

# Packaging for Release

----

When you are packing up your lambda API for release to AWS, ensure that you have installed this package as a development dependency only, otherwise it will significantly slow down and bloat your lambda.
