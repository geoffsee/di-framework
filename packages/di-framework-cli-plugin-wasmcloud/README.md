# @di-framework/cli-plugin-wasmcloud

di-framework CLI extension for targeting [wasmCloud](https://wasmcloud.com): build a DI Framework
HTTP app into a WASI 0.2 WebAssembly component, serve it locally, and deploy it through a Pulumi
program.

```bash
di-framework extensions install wasmcloud

di-framework wasmcloud build     # bundle + jco componentize → dist/<name>.wasm
di-framework wasmcloud dev       # build, then `jco serve` locally
di-framework wasmcloud deploy    # build, then `pulumi up` in the infra root above the project
di-framework wasmcloud destroy   # `pulumi destroy` for the same stack
di-framework wasmcloud doctor    # project + toolchain readiness checks
```

## Project convention

A component project is marked by `di-framework.config.json`:

```json
{ "name": "my-app", "entry": "src/app.ts", "output": "dist/my-app.wasm" }
```

The configured entry module default-exports a Fetch-compatible handler — a
`(request: Request) => Response | Promise<Response>` function or an object with such a `fetch`
method (a `@di-framework/http` `TypedRouter` works as-is). The extension owns the WebAssembly/WASI
boundary: it bundles the entry behind a WASI-HTTP ↔ Web Fetch adapter with vendored WASI 0.2.12
WIT definitions, then componentizes with `jco`. Build state lives in the disposable
`.di-framework/` directory.

`deploy`/`destroy` locate the nearest `Pulumi.yaml` above the project directory and run Pulumi
there with a local file backend by default. The stack is `DI_FRAMEWORK_STACK` (default `dev`);
`PULUMI_BACKEND_URL` and `PULUMI_CONFIG_PASSPHRASE` are honored when set. Long-running tool output
(`jco`, `pulumi`) streams directly to the terminal.

The manifest contract for extensions is documented in
[`@di-framework/cli-extension`](https://www.npmjs.com/package/@di-framework/cli-extension).
