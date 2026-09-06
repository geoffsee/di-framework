import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  candidatePackageNames,
  deriveCommandName,
  normalizeInstallSpec,
  RESERVED_COMMAND_NAMES,
} from '../extensions/names';
import {
  DEFAULT_EXTENSION_RUNNER,
  type ExtensionRunner,
  extensionsStoreDirectory,
  installExtension,
  installedExtensionPackages,
  listInstalledExtensions,
  uninstallExtension,
} from '../extensions/store';
import { COMMAND_TREE } from '../main';

const VALID_MANIFEST_SOURCE = `export default {
  schemaVersion: 1,
  name: 'demo',
  description: 'Demo extension',
  command: {
    description: 'Demo commands',
    children: {
      hello: { description: 'Say hello', run: () => ({ data: { ok: true } }) },
    },
  },
};
`;

function expectFailure(run: () => unknown, code: string, exitCode: number): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ code, exitCode });
    return;
  }
  throw new Error(`Expected a ${code} failure`);
}

function makeStore(dependencies: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'ext-store-'));
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'di-framework-extensions', private: true, dependencies })}\n`,
  );
  return root;
}

function writeExtensionPackage(
  root: string,
  packageName: string,
  indexSource: string,
  version = '1.0.0',
): void {
  const directory = join(root, 'node_modules', ...packageName.split('/'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'package.json'),
    `${JSON.stringify({ name: packageName, version, type: 'module', main: 'index.js' })}\n`,
  );
  writeFileSync(join(directory, 'index.js'), indexSource);
}

/** Simulates `bun add`/`bun remove` by editing the store like the real commands would. */
function simulatingRunner(
  invocations: string[][],
  behavior: { addSource?: string; failAdd?: boolean; failRemove?: boolean } = {},
): ExtensionRunner {
  return async (args, cwd) => {
    invocations.push([...args]);
    const [command, spec] = args;
    if (command === 'add') {
      if (behavior.failAdd) return { exitCode: 1, stderr: 'registry unavailable' };
      const rangeSeparator = (spec ?? '').indexOf('@', 1);
      const packageName =
        rangeSeparator === -1 ? (spec ?? '') : (spec ?? '').slice(0, rangeSeparator);
      const manifestPath = join(cwd, 'package.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.dependencies = { ...manifest.dependencies, [packageName]: '^1.0.0' };
      writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
      if (behavior.addSource !== undefined) {
        writeExtensionPackage(cwd, packageName, behavior.addSource);
      }
      return { exitCode: 0, stderr: '' };
    }
    if (behavior.failRemove) return { exitCode: 1, stderr: 'remove failed' };
    return { exitCode: 0, stderr: '' };
  };
}

describe('extension names', () => {
  it('reserves exactly the built-in top-level commands plus help', () => {
    expect(RESERVED_COMMAND_NAMES).toEqual(['help', ...Object.keys(COMMAND_TREE.children ?? {})]);
  });

  it('derives command names from all accepted package-name forms', () => {
    expect(deriveCommandName('@di-framework/cli-plugin-wasmcloud')).toBe('wasmcloud');
    expect(deriveCommandName('di-framework-cli-plugin-deploy-kit')).toBe('deploy-kit');
    expect(deriveCommandName('@acme/di-framework-cli-plugin-greet')).toBe('greet');
    expect(deriveCommandName('@di-framework/core')).toBeUndefined();
    expect(deriveCommandName('left-pad')).toBeUndefined();
    expect(deriveCommandName('@di-framework/cli-plugin-Bad_Name')).toBeUndefined();
  });

  it('orders candidate packages canonically and keeps only matching scoped installs', () => {
    expect(
      candidatePackageNames('demo', [
        '@acme/di-framework-cli-plugin-demo',
        '@acme/di-framework-cli-plugin-other',
        '@di-framework/cli-plugin-demo',
        'left-pad',
      ]),
    ).toEqual([
      '@di-framework/cli-plugin-demo',
      'di-framework-cli-plugin-demo',
      '@acme/di-framework-cli-plugin-demo',
    ]);
  });

  it('normalizes install specs for bare names, package names, and ranges', () => {
    expect(normalizeInstallSpec('demo')).toEqual({
      packageName: '@di-framework/cli-plugin-demo',
      commandName: 'demo',
      range: undefined,
    });
    expect(normalizeInstallSpec('demo@^2')).toEqual({
      packageName: '@di-framework/cli-plugin-demo',
      commandName: 'demo',
      range: '^2',
    });
    expect(normalizeInstallSpec('@di-framework/cli-plugin-demo@1.2.3')).toEqual({
      packageName: '@di-framework/cli-plugin-demo',
      commandName: 'demo',
      range: '1.2.3',
    });
    expect(normalizeInstallSpec('@acme/di-framework-cli-plugin-demo')).toEqual({
      packageName: '@acme/di-framework-cli-plugin-demo',
      commandName: 'demo',
      range: undefined,
    });
  });

  it('rejects specs that are empty, rangeless, or not extension packages', () => {
    for (const spec of ['', '@', 'demo@', '@di-framework/core', 'Bad_Name']) {
      expectFailure(() => normalizeInstallSpec(spec), 'INVALID_USAGE', 2);
    }
  });
});

describe('extensions store', () => {
  it('resolves the store directory from the environment override or the home default', () => {
    expect(extensionsStoreDirectory({ DI_FRAMEWORK_EXTENSIONS_DIR: '/custom/store' })).toBe(
      '/custom/store',
    );
    expect(extensionsStoreDirectory({}, '/home/dev')).toBe(
      join('/home/dev', '.di-framework', 'extensions'),
    );
  });

  it('lists nothing for a missing store and filters non-extension dependencies', () => {
    expect(listInstalledExtensions(join(tmpdir(), 'ext-store-definitely-missing'))).toEqual([]);
    const store = makeStore({
      '@di-framework/cli-plugin-demo': '^1.0.0',
      'left-pad': '^1',
    });
    writeExtensionPackage(store, '@di-framework/cli-plugin-demo', VALID_MANIFEST_SOURCE, '1.4.0');
    expect(installedExtensionPackages(store)).toEqual(['@di-framework/cli-plugin-demo']);
    expect(listInstalledExtensions(store)).toEqual([
      { name: 'demo', package: '@di-framework/cli-plugin-demo', version: '1.4.0' },
    ]);
  });

  it('reports unknown versions when the installed package manifest is unreadable', () => {
    const store = makeStore({ 'di-framework-cli-plugin-ghost': '^1' });
    expect(listInstalledExtensions(store)).toEqual([
      { name: 'ghost', package: 'di-framework-cli-plugin-ghost', version: 'unknown' },
    ]);
  });

  it('installs a valid extension through the runner and reports it', async () => {
    const invocations: string[][] = [];
    const store = mkdtempSync(join(tmpdir(), 'ext-install-'));
    const installed = await installExtension('demo@^1', {
      storeDirectory: join(store, 'nested', 'extensions'),
      runner: simulatingRunner(invocations, { addSource: VALID_MANIFEST_SOURCE }),
    });
    expect(installed).toEqual({
      name: 'demo',
      package: '@di-framework/cli-plugin-demo',
      version: '1.0.0',
    });
    expect(invocations).toEqual([['add', '@di-framework/cli-plugin-demo@^1']]);
  });

  it('keeps an existing store manifest and installs without a range', async () => {
    const invocations: string[][] = [];
    const store = makeStore({ 'left-pad': '^1' });
    await installExtension('@di-framework/cli-plugin-demo', {
      storeDirectory: store,
      runner: simulatingRunner(invocations, { addSource: VALID_MANIFEST_SOURCE }),
    });
    expect(invocations).toEqual([['add', '@di-framework/cli-plugin-demo']]);
    const manifest = JSON.parse(readFileSync(join(store, 'package.json'), 'utf8'));
    expect(manifest.dependencies['left-pad']).toBe('^1');
  });

  it('rejects reserved extension names before invoking the package manager', async () => {
    const invocations: string[][] = [];
    await expect(
      installExtension('mx', {
        storeDirectory: makeStore(),
        runner: simulatingRunner(invocations),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_NAME_RESERVED', exitCode: 2 });
    expect(invocations).toEqual([]);
  });

  it('surfaces package-manager install failures', async () => {
    await expect(
      installExtension('demo', {
        storeDirectory: makeStore(),
        runner: simulatingRunner([], { failAdd: true }),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_INSTALL_FAILED', exitCode: 3 });
  });

  it('rolls back when the installed package cannot be resolved', async () => {
    const invocations: string[][] = [];
    await expect(
      installExtension('demo', {
        storeDirectory: makeStore(),
        runner: simulatingRunner(invocations),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_LOAD_FAILED', exitCode: 3 });
    expect(invocations).toEqual([
      ['add', '@di-framework/cli-plugin-demo'],
      ['remove', '@di-framework/cli-plugin-demo'],
    ]);
  });

  it('rolls back when the installed manifest is invalid or misnamed', async () => {
    const invalid: string[][] = [];
    await expect(
      installExtension('demo', {
        storeDirectory: makeStore(),
        runner: simulatingRunner(invalid, { addSource: 'export default { schemaVersion: 1 };\n' }),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_MANIFEST_INVALID', exitCode: 3 });
    expect(invalid[1]).toEqual(['remove', '@di-framework/cli-plugin-demo']);

    const misnamed: string[][] = [];
    await expect(
      installExtension('demo', {
        storeDirectory: makeStore(),
        runner: simulatingRunner(misnamed, {
          addSource: VALID_MANIFEST_SOURCE.replace("name: 'demo'", "name: 'other'"),
        }),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_NAME_MISMATCH', exitCode: 3 });
    expect(misnamed[1]).toEqual(['remove', '@di-framework/cli-plugin-demo']);
  });

  it('uninstalls by command name or package name and reports missing extensions', async () => {
    const invocations: string[][] = [];
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1.0.0' });
    writeExtensionPackage(store, '@di-framework/cli-plugin-demo', VALID_MANIFEST_SOURCE);
    const removed = await uninstallExtension('demo', {
      storeDirectory: store,
      runner: simulatingRunner(invocations),
    });
    expect(removed.package).toBe('@di-framework/cli-plugin-demo');
    expect(invocations).toEqual([['remove', '@di-framework/cli-plugin-demo']]);

    await expect(
      uninstallExtension('missing', { storeDirectory: store, runner: simulatingRunner([]) }),
    ).rejects.toMatchObject({ code: 'EXTENSION_NOT_INSTALLED', exitCode: 1 });
  });

  it('surfaces package-manager uninstall failures', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1.0.0' });
    await expect(
      uninstallExtension('@di-framework/cli-plugin-demo', {
        storeDirectory: store,
        runner: simulatingRunner([], { failRemove: true }),
      }),
    ).rejects.toMatchObject({ code: 'EXTENSION_UNINSTALL_FAILED', exitCode: 3 });
  });

  it('runs the default runner against the hosting bun binary', async () => {
    const ok = await DEFAULT_EXTENSION_RUNNER(['--version'], tmpdir());
    expect(ok.exitCode).toBe(0);

    const failed = await DEFAULT_EXTENSION_RUNNER(
      ['run', 'definitely-not-a-script'],
      mkdtempSync(join(tmpdir(), 'ext-runner-')),
    );
    expect(failed.exitCode).not.toBe(0);
    expect(failed.stderr.length).toBeGreaterThan(0);
  });
});
