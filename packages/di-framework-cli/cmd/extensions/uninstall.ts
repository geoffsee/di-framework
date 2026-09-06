import { CommandFailure, type CommandResult, type JsonValue } from '../../command';
import type { uninstallExtension } from '../../extensions/store';

export type ExtensionsUninstallOperations = {
  readonly uninstallExtension: typeof uninstallExtension;
};

export function parseExtensionsUninstallArgs(args: readonly string[]): { nameOrPackage: string } {
  const [nameOrPackage, ...rest] = args;
  if (nameOrPackage === undefined || nameOrPackage.startsWith('--')) {
    invalidUsage('Missing extension name or package argument', nameOrPackage ?? '');
  }
  if (rest.length > 0) {
    invalidUsage(`Unexpected argument: ${rest[0]}`, rest[0] ?? '');
  }
  return { nameOrPackage };
}

export async function runExtensionsUninstall(
  args: readonly string[],
  operations?: ExtensionsUninstallOperations,
): Promise<CommandResult> {
  const { nameOrPackage } = parseExtensionsUninstallArgs(args);
  const api = operations ?? (await import('../../extensions/store'));
  const removed = await api.uninstallExtension(nameOrPackage);
  return {
    data: { ...removed },
    text: `Removed ${removed.package} (di-framework ${removed.name})`,
  };
}

function invalidUsage(
  message: string,
  token: string,
  details: Record<string, JsonValue> = {},
): never {
  throw new CommandFailure('INVALID_USAGE', message, 2, { token, ...details });
}
