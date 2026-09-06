import { CommandFailure, type CommandResult, type JsonValue } from '../../command';
import type { installExtension } from '../../extensions/store';

export type ExtensionsInstallOperations = {
  readonly installExtension: typeof installExtension;
};

export function parseExtensionsInstallArgs(args: readonly string[]): { spec: string } {
  const [spec, ...rest] = args;
  if (spec === undefined || spec.startsWith('--')) {
    invalidUsage('Missing extension package argument', spec ?? '');
  }
  if (rest.length > 0) {
    invalidUsage(`Unexpected argument: ${rest[0]}`, rest[0] ?? '');
  }
  return { spec };
}

export async function runExtensionsInstall(
  args: readonly string[],
  operations?: ExtensionsInstallOperations,
): Promise<CommandResult> {
  const { spec } = parseExtensionsInstallArgs(args);
  const api = operations ?? (await import('../../extensions/store'));
  const installed = await api.installExtension(spec);
  return {
    data: { ...installed },
    text: `Installed ${installed.package}@${installed.version}; run \`di-framework ${installed.name}\``,
  };
}

function invalidUsage(
  message: string,
  token: string,
  details: Record<string, JsonValue> = {},
): never {
  throw new CommandFailure('INVALID_USAGE', message, 2, { token, ...details });
}
