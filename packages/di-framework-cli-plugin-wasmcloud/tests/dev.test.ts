import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { parseDevArgs, runWasmcloudDev } from '../src/dev';
import { captureIo, expectFailure, fakeDeps, makeProject, type RunnerInvocation } from './helpers';

describe('parseDevArgs', () => {
  it('applies defaults and reads explicit values', () => {
    expect(parseDevArgs([])).toEqual({ host: '127.0.0.1', port: '8000' });
    expect(parseDevArgs(['--host', '0.0.0.0', '--port', '9000'])).toEqual({
      host: '0.0.0.0',
      port: '9000',
    });
  });

  it('rejects duplicates, missing values, and unknown tokens', () => {
    expectFailure(() => parseDevArgs(['--host', 'a', '--host', 'b']), 'INVALID_USAGE', 2);
    expectFailure(() => parseDevArgs(['--port', '1', '--port', '2']), 'INVALID_USAGE', 2);
    expectFailure(() => parseDevArgs(['--port']), 'INVALID_USAGE', 2);
    expectFailure(() => parseDevArgs(['--host', '--port']), 'INVALID_USAGE', 2);
    expectFailure(() => parseDevArgs(['serve']), 'INVALID_USAGE', 2);
  });
});

describe('runWasmcloudDev', () => {
  it('builds and then serves the component with jco', async () => {
    const root = makeProject();
    const invocations: RunnerInvocation[] = [];
    const output = captureIo();
    const result = await runWasmcloudDev(
      ['--port', '9123'],
      output.io,
      fakeDeps({ cwd: root, invocations }),
    );
    expect(invocations.map((invocation) => invocation.args[1])).toEqual(['componentize', 'serve']);
    expect(invocations[1]?.args).toEqual([
      '/fake/jco.js',
      'serve',
      join(root, 'dist', 'demo-app.wasm'),
      '--host',
      '127.0.0.1',
      '--port',
      '9123',
    ]);
    expect(output.stdout.join('')).toContain('http://127.0.0.1:9123');
    expect(result.data).toMatchObject({ host: '127.0.0.1', port: '9123' });
  });

  it('maps a failing dev server to WASMCLOUD_TOOL_FAILED', async () => {
    const root = makeProject();
    await expect(
      runWasmcloudDev([], captureIo().io, fakeDeps({ cwd: root, exitCodes: { serve: 7 } })),
    ).rejects.toMatchObject({
      code: 'WASMCLOUD_TOOL_FAILED',
      exitCode: 3,
      details: { command: 'jco serve', exitCode: 7 },
    });
  });
});
