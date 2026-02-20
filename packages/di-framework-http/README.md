# @di-framework/di-framework-http

Lightweight TypeScript decorators and a type-safe router for [itty-router](https://github.com/kwhitley/itty-router). Includes a build-time OpenAPI 3.1 generator. Ported from `itty-decorators`.

## Features

- **Type-Safe Routing**: `TypedRouter` provides full TypeScript support for request bodies, response types, and context.
- **Auto JSON Enforcement**: Automatically validates `Content-Type: application/json` for mutation methods (POST, PUT, PATCH).
- **Multipart Support**: Opt into `multipart/form-data` handling with `Multipart<T>` and `{ multipart: true }`.
- **Declarative Metadata**: Use `@Controller` and `@Endpoint` decorators to document your API logic directly in code.
- **OpenAPI 3.1 Support**: Generate a complete OpenAPI specification from your code at build time.
- **Minimal Footprint**: Built on top of the ultra-light `itty-router`.

## Installation

```bash
bun add @di-framework/di-framework-http
# or
npm install @di-framework/di-framework-http
```

## Quick Start

### 1. Create a Controller

Annotate your API logic using decorators and the `TypedRouter`.

```typescript
import {
  TypedRouter,
  json,
  type RequestSpec,
  type ResponseSpec,
  type Json,
  Controller,
  Endpoint,
} from "@di-framework/di-framework-http";

const router = TypedRouter();

type EchoPayload = { message: string };
type EchoResponse = { echoed: string; timestamp: string };

@Controller()
export class EchoController {
  @Endpoint({
    summary: "Echo a message",
    description: "Returns the provided message with a server timestamp.",
    responses: {
      "200": { description: "Successful echo" },
    },
  })
  static post = router.post<
    RequestSpec<Json<EchoPayload>>,
    ResponseSpec<EchoResponse>
  >("/echo", (req) => {
    // req.content is typed as EchoPayload
    return json({
      echoed: req.content.message,
      timestamp: new Date().toISOString(),
    });
  });
}

// Add a simple GET route
router.get("/", () => json({ message: "API is healthy" }));

export default {
  fetch: (request: Request, env: any, ctx: any) =>
    router.fetch(request, env, ctx),
};
```

### 2. Multipart File Uploads

Use `Multipart<T>` and `{ multipart: true }` to accept `multipart/form-data` instead of JSON. The handler receives `req.content` typed as `FormData`.

```typescript
import {
  TypedRouter,
  json,
  type RequestSpec,
  type ResponseSpec,
  type Multipart,
} from "@di-framework/di-framework-http";

const router = TypedRouter();

type UploadPayload = { files: File[] };
type UploadResult = { filenames: string[] };

router.post<RequestSpec<Multipart<UploadPayload>>, ResponseSpec<UploadResult>>(
  "/upload",
  (req) => {
    // req.content is typed as FormData
    const files = req.content.getAll("files") as File[];
    return json({ filenames: files.map((f) => f.name) });
  },
  { multipart: true },
);
```

### OpenAPI Generation

`@di-framework/di-framework-http` provides a built-in CLI and a registry to generate OpenAPI specs from your controllers.

#### Using the CLI

The easiest way to generate a spec is using the provided CLI tool.

```bash
# Generate openapi.json from your controllers
bun x di-framework-http generate --controllers ./src/index.ts
```

**Options:**

- `--controllers <path>`: (Required) Path to the file that imports all your decorated controllers.
- `--output <path>`: (Optional) Path to save the generated JSON (default: `openapi.json`).

#### Manual Generation

You can also generate the spec programmatically using the `generateOpenAPI` function and the default `registry`:

```typescript
import registry, { generateOpenAPI } from "@di-framework/di-framework-http";
import "./controllers/MyController"; // Import to trigger registration

const spec = generateOpenAPI(
  {
    title: "My API",
    version: "1.0.0",
  },
  registry,
);

console.log(JSON.stringify(spec, null, 2));
```

If you need full control, you can iterate the `registry` manually:

```typescript
import registry from "@di-framework/di-framework-http";

for (const target of registry.getTargets()) {
  // target is the decorated class
  // target[methodName].isEndpoint will be true
  // target[methodName].metadata contains your @Endpoint info
}
```

## API Reference

### `TypedRouter<Args[]>()`

A proxy for `itty-router` that enables type-safe method definitions.

- `Args`: An array of types representing additional arguments passed to `fetch` (e.g., `[Env, ExecutionContext]`).

### `json<T>(data: T, init?: ResponseInit)`

A typed wrapper around itty-router's `json` helper.

### `Json<T>` / `Multipart<T>`

Body spec markers used with `RequestSpec<>` to declare the expected content type. `Json<T>` types `req.content` as `T`; `Multipart<T>` types it as `FormData`. Multipart routes require passing `{ multipart: true }` as the third argument to the route method.

### `@Controller()`

Class decorator that marks a class for inclusion in the OpenAPI registry.

### `@Endpoint(metadata)`

Method or property decorator that attaches OpenAPI metadata.

- `summary`: Short summary of the operation.
- `description`: Verbose explanation.
- `requestBody`: OpenAPI Request Body object.
- `responses`: OpenAPI Responses object.

## License

MIT
