# Local wasmCloud platform

This Pulumi project provisions **platform** resources only:

- a local [k0s](https://k0sproject.io) cluster
- an in-Docker OCI registry on `localhost:5000`
- the wasmCloud operator as a `kubernetes.helm.v3.Release`

k0s and the registry are local Docker commands because they are not Kubernetes
objects. Once k0s yields a kubeconfig, that value is passed to a Kubernetes
provider and the operator is installed with Helm Release — not `helm` via a
shell script.

It does not define applications, component images, Kubernetes Services for apps,
or `WorkloadDeployment` objects. Those are derived by
`di-framework wasmcloud deploy` from each project's `di-framework.config.json`.

## Output contract

| Output | Meaning |
| --- | --- |
| `kubeconfig` | kubeconfig YAML for the k0s API |
| `namespace` | Kubernetes namespace (`wasmcloud`) |
| `registry` | OCI prefix (`localhost:5000`) |
| `endpoints.kubernetes` | API server |
| `endpoints.registry` | registry host |
| `endpoints.http` | HTTP entrypoint |

## Start

Requires Docker. From the workspace root:

```bash
di-framework wasmcloud platform deploy local --yes
```

Tear down with `di-framework wasmcloud platform destroy local --yes`. Never use
`pulumi destroy` to remove an application.
