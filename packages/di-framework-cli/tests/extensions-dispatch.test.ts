import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CliIo } from '../command';
import { createExtensionDispatch, type ExtensionDispatch } from '../extensions/dispatch';
import { main } from '../main';

function manifestSource(name: string, description: string): string {
  return `export default {
  schemaVersion: 1,
  name: '${name}',
  description: '${description}',
  command: {
    description: '${description}',
    children: {
      hello: {
        description: 'Say hello',
        run: ({ args, io }) => {
          io.stdout.write('hello ' + (args[0] ?? 'world') + '\\n');
          return { data: { greeted: args[0] ?? 'world', from: '${description}' } };
        },
      },
    },
  },
};
`;
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

function makeStore(dependencies: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ext-dispatch-store-'));
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'di-framework-extensions', private: true, dependencies })}\n`,
  );
  return root;
}

function makeProject(dependencies: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'ext-dispatch-project-'));
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'project', version: '0.0.0', dependencies })}\n`,
  );
  return root;
}

function emptyDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'ext-dispatch-empty-'));
}

function captureIo(): { stdout: string[]; stderr: string[]; io: CliIo } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: { write: (chunk) => stdout.push(chunk) },
      stderr: { write: (chunk) => stderr.push(chunk) },
    },
  };
}

describe('extension dispatch', () => {
  it('resolves a store-installed extension by convention', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
    writeExtensionPackage(
      store,
      '@di-framework/cli-plugin-demo',
      manifestSource('demo', 'Store demo'),
    );
    const dispatch = createExtensionDispatch(store);
    const command = await dispatch.resolveCommand('demo', emptyDirectory());
    expect(command?.description).toBe('Store demo');
    expect(Object.keys(command?.children ?? {})).toEqual(['hello']);
  });

  it('prefers a project-local extension over the user-global store', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
    writeExtensionPackage(
      store,
      '@di-framework/cli-plugin-demo',
      manifestSource('demo', 'Store demo'),
    );
    const project = makeProject({ '@di-framework/cli-plugin-demo': '^2' });
    writeExtensionPackage(
      project,
      '@di-framework/cli-plugin-demo',
      manifestSource('demo', 'Project demo'),
      '2.0.0',
    );
    const dispatch = createExtensionDispatch(store);
    const command = await dispatch.resolveCommand('demo', project);
    expect(command?.description).toBe('Project demo');
  });

  it('resolves arbitrary-scope packages recorded in the store manifest', async () => {
    const store = makeStore({ '@acme/di-framework-cli-plugin-scoped': '^1' });
    writeExtensionPackage(
      store,
      '@acme/di-framework-cli-plugin-scoped',
      manifestSource('scoped', 'Scoped demo'),
    );
    const dispatch = createExtensionDispatch(store);
    const command = await dispatch.resolveCommand('scoped', emptyDirectory());
    expect(command?.description).toBe('Scoped demo');
  });

  it('returns undefined for invalid tokens and unresolved extensions', async () => {
    const dispatch = createExtensionDispatch(makeStore({}));
    expect(await dispatch.resolveCommand('Not_A_Token', emptyDirectory())).toBeUndefined();
    expect(await dispatch.resolveCommand('missing', emptyDirectory())).toBeUndefined();
  });

  it('mounts failure nodes for broken, invalid, and misnamed extensions', async () => {
    const cases: Array<{ source: string; code: string }> = [
      { source: 'export default {', code: 'EXTENSION_LOAD_FAILED' },
      { source: 'export default { schemaVersion: 1 };\n', code: 'EXTENSION_MANIFEST_INVALID' },
      { source: manifestSource('other', 'Misnamed'), code: 'EXTENSION_NAME_MISMATCH' },
    ];
    for (const { source, code } of cases) {
      const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
      writeExtensionPackage(store, '@di-framework/cli-plugin-demo', source);
      const dispatch = createExtensionDispatch(store);
      const command = await dispatch.resolveCommand('demo', emptyDirectory());
      expect(command?.description).toContain('unavailable extension');
      try {
        command?.run?.({ args: [], command: ['demo'], io: captureIo().io });
        throw new Error(`Expected a ${code} failure`);
      } catch (error) {
        expect(error).toMatchObject({ code, exitCode: 3 });
      }
    }
  });

  it('lists installed stubs from the project and the store without duplicates', () => {
    const store = makeStore({
      '@di-framework/cli-plugin-demo': '^1',
      'di-framework-cli-plugin-extra': '^1',
    });
    const project = makeProject({ '@di-framework/cli-plugin-demo': '^2' });
    const stubs = createExtensionDispatch(store).installedStubs(project);
    expect(Object.keys(stubs).sort()).toEqual(['demo', 'extra']);
    expect(stubs.demo?.description).toContain('@di-framework/cli-plugin-demo');
    expect(stubs.demo?.run?.({ args: [], command: ['demo'], io: captureIo().io })).toBeUndefined();
  });

  it('runs a mounted extension end-to-end through main with the JSON envelope', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
    writeExtensionPackage(
      store,
      '@di-framework/cli-plugin-demo',
      manifestSource('demo', 'Store demo'),
    );
    const dispatch = createExtensionDispatch(store);

    const json = captureIo();
    expect(await main(['demo', 'hello', 'Ada', '--json'], json.io, dispatch)).toBe(0);
    expect(JSON.parse(json.stdout.join(''))).toEqual({
      schemaVersion: 1,
      command: 'demo hello',
      ok: true,
      data: { greeted: 'Ada', from: 'Store demo' },
    });

    const text = captureIo();
    expect(await main(['demo', 'hello'], text.io, dispatch)).toBe(0);
    expect(text.stdout.join('')).toContain('hello world');

    const help = captureIo();
    expect(await main(['demo', '--help'], help.io, dispatch)).toBe(0);
    expect(help.stdout.join('')).toContain('Say hello');
  });

  it('reports failing extensions through the standard envelope with exit 3', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
    writeExtensionPackage(store, '@di-framework/cli-plugin-demo', 'export default {');
    const dispatch = createExtensionDispatch(store);
    const captured = captureIo();
    expect(await main(['demo', 'hello', '--json'], captured.io, dispatch)).toBe(3);
    expect(JSON.parse(captured.stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      ok: false,
      error: { code: 'EXTENSION_LOAD_FAILED' },
    });
  });

  it('keeps unknown commands on the standard usage exit when nothing is installed', async () => {
    const dispatch = createExtensionDispatch(makeStore({}));
    const captured = captureIo();
    expect(await main(['nothing-here'], captured.io, dispatch)).toBe(2);
    expect(captured.stderr.join('')).toContain('Unknown command: nothing-here');
  });

  it('shows installed extensions in root help and never consults dispatch for built-ins', async () => {
    const store = makeStore({ '@di-framework/cli-plugin-demo': '^1' });
    const dispatch = createExtensionDispatch(store);
    const help = captureIo();
    expect(await main(['--help'], help.io, dispatch)).toBe(0);
    expect(help.stdout.join('')).toContain('demo');

    const missing = captureIo();
    expect(await main([], missing.io, dispatch)).toBe(2);
    expect(missing.stderr.join('')).toContain('demo');

    const untouchable: ExtensionDispatch = {
      resolveCommand: () => {
        throw new Error('dispatch must not resolve built-ins');
      },
      installedStubs: () => {
        throw new Error('dispatch must not stub non-help invocations');
      },
    };
    const builtIn = captureIo();
    expect(await main(['mx', 'help'], builtIn.io, untouchable)).toBe(0);
    expect(builtIn.stdout.join('')).toContain('publish');
  });
});
