import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExtensionDispatch } from '../extensions/dispatch';
import { main } from '../main';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');
const PLUGIN_ROOT = join(REPO_ROOT, 'packages', 'di-framework-cli-plugin-wasmcloud');

function captureIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: { write: (chunk: string) => stdout.push(chunk) },
      stderr: { write: (chunk: string) => stderr.push(chunk) },
    },
  };
}

describe('wasmcloud extension end-to-end', () => {
  afterEach(() => {
    process.chdir(REPO_ROOT);
  });

  it('mounts the built plugin from a synthetic store and runs doctor', async () => {
    const store = mkdtempSync(join(tmpdir(), 'ext-e2e-store-'));
    writeFileSync(
      join(store, 'package.json'),
      `${JSON.stringify({
        name: 'di-framework-extensions',
        private: true,
        dependencies: { '@di-framework/cli-plugin-wasmcloud': '^5' },
      })}\n`,
    );
    mkdirSync(join(store, 'node_modules', '@di-framework'), { recursive: true });
    symlinkSync(PLUGIN_ROOT, join(store, 'node_modules', '@di-framework', 'cli-plugin-wasmcloud'));

    const project = mkdtempSync(join(tmpdir(), 'ext-e2e-project-'));
    writeFileSync(
      join(project, 'di-framework.config.json'),
      `${JSON.stringify({ name: 'E2E App', entry: 'app.ts' })}\n`,
    );
    writeFileSync(join(project, 'app.ts'), 'export default () => new Response("ok");\n');

    const dispatch = createExtensionDispatch(store);

    const help = captureIo();
    expect(await main(['wasmcloud', '--help'], help.io, dispatch)).toBe(0);
    expect(help.stdout.join('')).toContain('doctor');

    const doctor = captureIo();
    process.chdir(project);
    const exitCode = await main(['wasmcloud', 'doctor', '--json'], doctor.io, dispatch);
    const envelope = JSON.parse(doctor.stdout.join(''));
    expect(envelope).toMatchObject({ schemaVersion: 1, command: 'wasmcloud doctor' });
    expect(envelope.data.application).toBe('E2E App');
    expect(envelope.data.checks.length).toBeGreaterThan(0);
    expect([0, 1]).toContain(exitCode);
    expect(envelope.ok).toBe(exitCode === 0);
  }, 60_000); // doctor probes real tools; each probe is bounded, the sum can exceed bun's 5s default
});
