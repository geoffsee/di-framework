import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_DEPS } from '../src/deps';
import { requireNodeBinary } from '../src/support';
import { renderWorldWit, type WitRequirement } from '../src/wit';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'p3-canary');

const canaryRequirements: WitRequirement[] = [
  {
    package: 'local:p3-canary',
    version: '0.1.0',
    interfaces: ['store'],
    direction: 'import',
    instanceName: 'cache',
    source: 'canary',
  },
  {
    package: 'local:p3-canary',
    version: '0.1.0',
    interfaces: ['store'],
    direction: 'import',
    instanceName: 'durable',
    source: 'canary',
  },
  {
    package: 'local:p3-canary',
    version: '0.1.0',
    interfaces: ['stats'],
    direction: 'import',
    source: 'canary',
  },
];

describe('P3 TypeScript toolchain canary', () => {
  it('encodes named instances and a shared resource type in generated WIT', () => {
    const world = renderWorldWit('p3-canary', '0.1.0', canaryRequirements);
    expect(world).toContain('import cache: local:p3-canary/store@0.1.0;');
    expect(world).toContain('import durable: local:p3-canary/store@0.1.0;');
    expect(world).toContain('import local:p3-canary/stats@0.1.0;');
  });

  async function componentize(witDirectory: string, outputName: string) {
    const node = requireNodeBinary(DEFAULT_DEPS.nodeBinaryPath());
    const outDir = mkdtempSync(join(tmpdir(), 'p3-canary-'));
    return DEFAULT_DEPS.runner(
      node,
      [
        DEFAULT_DEPS.jcoCliPath(),
        'componentize',
        '--backend',
        'qjs',
        '-w',
        witDirectory,
        '-n',
        'application',
        '-o',
        join(outDir, outputName),
        join(FIXTURE, 'guest.js'),
      ],
      { cwd: FIXTURE },
    );
  }

  it('componentizes exported async funcs, futures, streams, cancellation, and a shared resource type', async () => {
    const result = await componentize(join(FIXTURE, 'wit'), 'canary.wasm');
    expect(result.exitCode).toBe(0);
  }, 60_000);

  it('records that imported async funcs still mismatch the qjs linker', async () => {
    const captured = await DEFAULT_DEPS.runCaptured(
      requireNodeBinary(DEFAULT_DEPS.nodeBinaryPath()),
      [
        DEFAULT_DEPS.jcoCliPath(),
        'componentize',
        '--backend',
        'qjs',
        '-w',
        join(FIXTURE, 'wit-import-async'),
        '-n',
        'application',
        '-o',
        join(mkdtempSync(join(tmpdir(), 'p3-import-')), 'import.wasm'),
        join(FIXTURE, 'guest-probe.js'),
      ],
      { cwd: FIXTURE },
    );
    expect(captured.exitCode).not.toBe(0);
    expect(`${captured.stdout}\n${captured.stderr}`).toContain('type mismatch with async');
  }, 60_000);

  it('records that labeled imports still require cm-implements in the qjs backend', async () => {
    const captured = await DEFAULT_DEPS.runCaptured(
      requireNodeBinary(DEFAULT_DEPS.nodeBinaryPath()),
      [
        DEFAULT_DEPS.jcoCliPath(),
        'componentize',
        '--backend',
        'qjs',
        '-w',
        join(FIXTURE, 'wit-named'),
        '-n',
        'application',
        '-o',
        join(mkdtempSync(join(tmpdir(), 'p3-named-')), 'named.wasm'),
        join(FIXTURE, 'guest-probe.js'),
      ],
      { cwd: FIXTURE },
    );
    expect(captured.exitCode).not.toBe(0);
    expect(`${captured.stdout}\n${captured.stderr}`).toContain('cm-implements');
  }, 60_000);
});
