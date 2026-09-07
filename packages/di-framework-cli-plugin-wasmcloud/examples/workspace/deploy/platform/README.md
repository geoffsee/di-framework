# wasmCloud platform

This directory is produced by `di-framework wasmcloud platform init` from templates
shipped with `@di-framework/cli-plugin-wasmcloud`. Run that command from the
workspace root rather than copying a Pulumi program by hand.

```bash
di-framework wasmcloud platform init
di-framework wasmcloud platform deploy local --yes
```

The generated project installs its own dependencies through `pulumi install`,
uses loopback-only high host ports, and reports the HTTP URL after deployment.
