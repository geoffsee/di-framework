import { CommandFailure, type CommandResult } from '../../command';
import type { listInstalledExtensions } from '../../extensions/store';

export type ExtensionsListOperations = {
  readonly listInstalledExtensions: typeof listInstalledExtensions;
};

export async function runExtensionsList(
  args: readonly string[],
  operations?: ExtensionsListOperations,
): Promise<CommandResult> {
  if (args.length > 0) {
    throw new CommandFailure(
      'INVALID_USAGE',
      `extensions list does not accept arguments: ${args[0]}`,
      2,
      {
        token: args[0] ?? '',
      },
    );
  }
  const api = operations ?? (await import('../../extensions/store'));
  const extensions = api.listInstalledExtensions();
  const text =
    extensions.length === 0
      ? 'No extensions installed.'
      : extensions
          .map((extension) => `${extension.name}  ${extension.package}@${extension.version}`)
          .join('\n');
  return { data: { extensions: extensions.map((extension) => ({ ...extension })) }, text };
}
