# @di-framework/cli-plugin-wasmcloud

di-framework CLI extension for targeting [wasmCloud](https://wasmcloud.com): build a DI Framework
HTTP app into a WASI 0.2 WebAssembly component, serve it locally, and deploy it from a workspace
manifest.

```bash
di-framework extensions install wasmcloud

di-framework wasmcloud build                         # bundle + jco componentize → dist/<name>.wasm
di-framework wasmcloud dev                           # build, then `jco serve` locally
di-framework wasmcloud deploy                        # nearest project, default target
di-framework wasmcloud deploy greeter                # named project anywhere in the workspace
di-framework wasmcloud deploy greeter --target development
di-framework wasmcloud destroy greeter
di-framework wasmcloud platform init                 # generate deploy/platform + local target
di-framework wasmcloud platform deploy local --yes   # start the generated platform
di-framework wasmcloud platform destroy local --yes
di-framework wasmcloud doctor                        # project + toolchain readiness checks
```

Run these commands directly. Do not wrap them in `package.json` scripts.

## Project convention

A component project is marked by `di-framework.config.json`:

```json
{ "name": "my-app", "entry": "src/app.ts", "output": "dist/my-app.wasm" }
```

The configured `name` is the only project identity. The extension owns the WebAssembly/WASI
boundary: it bundles the entry behind a WASI-HTTP ↔ Web Fetch adapter with vendored WASI 0.2.12
WIT definitions, then componentizes with `jco`. Build state lives in the disposable
`.di-framework/` directory.

## Deployment manifest

Deployment topology lives in `di-framework.deploy.toml` at the workspace root. The CLI finds it by
walking upward from the current directory. The file describes **targets**, not applications: there
is no `apps` table, and projects may live in any directory layout.

```toml
default-target = "local"

[targets.local]
platform = "deploy/platform"
stack = "dev"

[targets.development]
kubeconfig = "${KUBECONFIG}"
context = "team-development"
namespace = "wasmcloud"
registry = "registry.example.com/team"
```

- `di-framework wasmcloud deploy` with no name uses the nearest `di-framework.config.json`.
- `di-framework wasmcloud deploy greeter` recursively discovers projects (skipping `.git`,
  `node_modules`, `.di-framework`, and generated output by default) and matches the configured
  `name`. Duplicate names fail with every conflicting path.
- `${VAR}` interpolation fails if the variable is unset or empty. Do not put credentials in the
  manifest.

### Managed Pulumi target

From the workspace root, generate a self-contained local platform (k0s, a local OCI registry, and
the wasmCloud operator) from templates shipped with this extension:

```bash
di-framework wasmcloud platform init
di-framework wasmcloud platform deploy local --yes
```

`platform init` writes `deploy/platform` and creates or updates `di-framework.deploy.toml` so
`local` is a managed target (`platform = "deploy/platform"`, `stack = "dev"`). Existing files are
left alone unless you pass `--force`. The command prints the exact start command when it finishes.

The generated Pulumi project provisions only platform concerns. It must not contain application
names, component builds, Services, or WorkloadDeployments.

The CLI reads a small output contract from `pulumi stack output --json`:

| Output | Required | Meaning |
| --- | --- | --- |
| `kubeconfig` | yes | kubeconfig YAML or a filesystem path |
| `namespace` | yes | Kubernetes namespace for workloads |
| `registry` | yes | OCI registry prefix |
| `context` | no | kubectl context |
| `endpoints.http` / `endpoints.kubernetes` / `endpoints.registry` | no | optional URLs |

Provision and tear down that stack explicitly:

```bash
di-framework wasmcloud platform deploy local --yes
di-framework wasmcloud platform destroy local --yes
```

Application `destroy` never runs `pulumi destroy`.

### Existing cluster

When kubeconfig and a registry are already available, declare an external target with only access
information (as `development` above) and deploy:

```bash
export KUBECONFIG="$HOME/.kube/config"
di-framework wasmcloud deploy greeter --target development
```

## Application deploy

For the selected project the extension:

1. Builds the component.
2. Publishes it with `oras` under an immutable content-derived reference (`<registry>/<wit-name>:sha256-<digest>`).
3. Derives a wasmCloud `WorkloadDeployment` and Kubernetes `Service` (written under `.di-framework/deploy/`, not checked in).
4. Applies them with `kubectl` and waits until the workload is ready.

## Demonstration layout

A complete workspace is in [`examples/workspace`](./examples/workspace): `deploy/platform` plus
projects at `services/greeter` and `nested/deep/echo`. Copy that tree or start from the TOML
above.

The manifest contract for extensions is documented in
[`@di-framework/cli-extension`](https://www.npmjs.com/package/@di-framework/cli-extension).
