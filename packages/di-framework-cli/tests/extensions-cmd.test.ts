import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseExtensionsInstallArgs, runExtensionsInstall } from '../cmd/extensions/install';
import { runExtensionsList } from '../cmd/extensions/list';
import { parseExtensionsUninstallArgs, runExtensionsUninstall } from '../cmd/extensions/uninstall';

const previousStore = process.env.DI_FRAMEWORK_EXTENSIONS_DIR;
afterEach(() => {
  process.env.DI_FRAMEWORK_EXTENSIONS_DIR = previousStore;
});

function useTemporaryStore(dependencies?: Record<string, string>): string {
  const store = mkdtempSync(join(tmpdir(), 'ext-cmd-store-'));
  if (dependencies) {
    writeFileSync(
      join(store, 'package.json'),
      `${JSON.stringify({ name: 'di-framework-extensions', private: true, dependencies })}\n`,
    );
  }
  process.env.DI_FRAMEWORK_EXTENSIONS_DIR = store;
  return store;
}

describe('extensions command adapters', () => {
  it('parses a single positional argument and rejects everything else', () => {
    expect(parseExtensionsInstallArgs(['demo'])).toEqual({ spec: 'demo' });
    expect(parseExtensionsUninstallArgs(['@di-framework/cli-plugin-demo'])).toEqual({
      nameOrPackage: '@di-framework/cli-plugin-demo',
    });
    for (const args of [[], ['--flag'], ['demo', 'extra']]) {
      for (const parse of [parseExtensionsInstallArgs, parseExtensionsUninstallArgs]) {
        try {
          parse(args);
          throw new Error(`Expected INVALID_USAGE for ${JSON.stringify(args)}`);
        } catch (error) {
          expect(error).toMatchObject({ code: 'INVALID_USAGE', exitCode: 2 });
        }
      }
    }
  });

  it('delegates install to the injected operation and formats the result', async () => {
    const calls: string[] = [];
    const result = await runExtensionsInstall(['demo'], {
      installExtension: async (spec) => {
        calls.push(spec);
        return { name: 'demo', package: '@di-framework/cli-plugin-demo', version: '1.2.3' };
      },
    });
    expect(calls).toEqual(['demo']);
    expect(result.data).toEqual({
      name: 'demo',
      package: '@di-framework/cli-plugin-demo',
      version: '1.2.3',
    });
    expect(result.text).toContain('di-framework demo');
  });

  it('delegates uninstall to the injected operation and formats the result', async () => {
    const result = await runExtensionsUninstall(['demo'], {
      uninstallExtension: async () => ({
        name: 'demo',
        package: '@di-framework/cli-plugin-demo',
        version: '1.2.3',
      }),
    });
    expect(result.data).toMatchObject({ package: '@di-framework/cli-plugin-demo' });
    expect(result.text).toContain('Removed @di-framework/cli-plugin-demo');
  });

  it('delegates list to the injected operation and formats entries', async () => {
    const result = await runExtensionsList([], {
      listInstalledExtensions: () => [
        { name: 'demo', package: '@di-framework/cli-plugin-demo', version: '1.2.3' },
      ],
    });
    expect(result.data).toEqual({
      extensions: [{ name: 'demo', package: '@di-framework/cli-plugin-demo', version: '1.2.3' }],
    });
    expect(result.text).toContain('demo  @di-framework/cli-plugin-demo@1.2.3');
    await expect(runExtensionsList(['unexpected'])).rejects.toMatchObject({
      code: 'INVALID_USAGE',
      exitCode: 2,
    });
  });

  it('loads the real store operations when none are injected', async () => {
    useTemporaryStore();
    const empty = await runExtensionsList([]);
    expect(empty.data).toEqual({ extensions: [] });
    expect(empty.text).toBe('No extensions installed.');

    await expect(runExtensionsInstall(['mx'])).rejects.toMatchObject({
      code: 'EXTENSION_NAME_RESERVED',
      exitCode: 2,
    });
    await expect(runExtensionsUninstall(['demo'])).rejects.toMatchObject({
      code: 'EXTENSION_NOT_INSTALLED',
      exitCode: 1,
    });
  });
});
