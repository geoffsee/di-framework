# Demonstration workspace

Layout is arbitrary. There is no `apps/` directory and the deploy manifest has
no application list.

```text
di-framework.deploy.toml
deploy/platform/          managed Pulumi platform (k0s-adjacent cluster, registry, operator)
services/greeter/         a DI Framework project
nested/deep/echo/         another project, nested wherever it fits
```

## Managed platform

```bash
di-framework wasmcloud platform init
di-framework wasmcloud platform deploy local --yes
di-framework wasmcloud deploy greeter
di-framework wasmcloud destroy greeter
di-framework wasmcloud platform destroy local --yes
```

## Existing cluster (kubeconfig + registry only)

```bash
export KUBECONFIG="$HOME/.kube/config"
di-framework wasmcloud deploy greeter --target development
di-framework wasmcloud deploy echo --target development
```

Run the CLI directly. Do not wrap these commands in `package.json` scripts.
