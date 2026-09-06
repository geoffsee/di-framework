import { describe, expect, it } from 'bun:test';
import { validateExtensionManifest } from '@di-framework/cli-extension';
import { createWasmcloudCommand } from '../src/command';
import manifest from '../src/index';
import { captureIo, fakeDeps } from './helpers';

describe('extension manifest', () => {
  it('default-exports a valid manifest named wasmcloud', () => {
    expect(validateExtensionManifest(manifest)).toEqual([]);
    expect(manifest.name).toBe('wasmcloud');
    expect(Object.keys(manifest.command.children ?? {})).toEqual([
      'build',
      'dev',
      'deploy',
      'destroy',
      'doctor',
    ]);
  });

  it('threads injected dependencies through every leaf', async () => {
    const command = createWasmcloudCommand(fakeDeps({ cwd: '/nowhere' }));
    for (const [name, child] of Object.entries(command.children ?? {})) {
      expect(child.run).toBeDefined();
      // Each leaf parses arguments first; an unknown flag proves delegation without
      // touching a real project or toolchain.
      await expect(
        Promise.resolve(
          child.run?.({ args: ['--bogus'], command: ['wasmcloud', name], io: captureIo().io }),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_USAGE', exitCode: 2 });
    }
  });
});
