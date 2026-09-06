# @di-framework/cli-extension

Author API for `di-framework` CLI extensions.

An extension is an npm package named `@di-framework/cli-plugin-<name>` (or
`di-framework-cli-plugin-<name>`, or `@<scope>/di-framework-cli-plugin-<name>`) whose default
export is an extension manifest. Once installed, the CLI mounts its command tree at
`di-framework <name>`, and the extension inherits the CLI's help rendering, `--json` envelope,
and exit-code contract.

```ts
import { defineExtension } from '@di-framework/cli-extension';

export default defineExtension({
  schemaVersion: 1,
  name: 'greet',
  description: 'Greeting operations',
  command: {
    description: 'Greeting operations',
    children: {
      hello: {
        description: 'Print a greeting',
        usage: 'di-framework greet hello [--name <name>]',
        options: ['--name <name>  Who to greet'],
        run: ({ args, io }) => {
          const name = args[1] ?? 'world';
          io.stdout.write(`hello ${name}\n`);
          return { data: { name } };
        },
      },
    },
  },
});
```

Rules:

- `name` must match `/^[a-z][a-z0-9-]*$/` and equal the `<name>` in the package name.
- Every command node defines exactly one of `children` (group) or `run` (leaf).
- Handlers never call `process.exit` and never write to `console`; use the injected `io` and
  return a `CommandResult`. Report failures by throwing `CommandFailure` from this package.
- Extension packages must not declare a `bin`; `di-framework` is the only executable.

This package also exports the command types used by `@di-framework/cli` itself: `CommandNode`,
`CommandContext`, `CommandResult`, `CliIo`, `ExitCode`, `JsonValue`, `CommandFailure`, and the
structural guard `isCommandFailure`.
