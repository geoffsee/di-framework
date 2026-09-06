import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CliIo } from '@di-framework/cli-extension';
import type { WasmcloudDeps } from '../src/deps';

export type RunnerInvocation = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
};

export function captureIo(): { stdout: string[]; stderr: string[]; io: CliIo } {
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

/** Temp project with `di-framework.config.json`, an entry module, and a package.json. */
export function makeProject(
  config: Record<string, unknown> = { name: 'Demo App', entry: 'src/app.ts' },
  packageJson: Record<string, unknown> | null = { name: 'demo', version: '1.2.3' },
): string {
  const root = mkdtempSync(join(tmpdir(), 'wasmcloud-project-'));
  writeFileSync(join(root, 'di-framework.config.json'), `${JSON.stringify(config)}\n`);
  if (packageJson !== null) {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify(packageJson)}\n`);
  }
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'app.ts'), 'export default () => new Response("ok");\n');
  return root;
}

/** Temp assets directory shaped like the shipped `dist/assets`. */
export function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'wasmcloud-assets-'));
  mkdirSync(join(root, 'wit', 'deps', 'wasi-http'), { recursive: true });
  writeFileSync(join(root, 'wit', 'deps', 'wasi-http', 'package.wit'), 'package wasi:http;\n');
  writeFileSync(join(root, 'http-adapter.js'), 'export const incomingHandler = {};\n');
  return root;
}

export function fakeDeps(options: {
  invocations?: RunnerInvocation[];
  cwd: string;
  assets?: string;
  env?: Record<string, string | undefined>;
  exitCodes?: Record<string, number>;
  captures?: Record<string, string | undefined>;
  resolutions?: Record<string, string | undefined>;
  bundlerError?: Error;
  /** null = no node binary available. */
  nodeBinaryPath?: string | null;
}): WasmcloudDeps {
  const invocations = options.invocations ?? [];
  return {
    runner: async (command, args, runOptions) => {
      invocations.push({
        command,
        args: [...args],
        cwd: runOptions.cwd,
        env: runOptions.env,
      });
      const key = command === 'pulumi' ? `pulumi ${args[0]}` : (args[1] ?? command);
      return { exitCode: options.exitCodes?.[key] ?? 0 };
    },
    capture: (command) => options.captures?.[command],
    bundler: async ({ outFile }) => {
      if (options.bundlerError) throw options.bundlerError;
      writeFileSync(outFile, 'export const bundled = true;\n');
    },
    jcoCliPath: () => '/fake/jco.js',
    nodeBinaryPath: () =>
      options.nodeBinaryPath === null ? undefined : (options.nodeBinaryPath ?? '/fake/node'),
    assetsDirectory: () => options.assets ?? makeAssets(),
    resolveFromProject: (_projectRoot, specifier) => options.resolutions?.[specifier],
    env: options.env ?? {},
    cwd: () => options.cwd,
  };
}

export function expectFailure(run: () => unknown, code: string, exitCode: number): void {
  try {
    run();
  } catch (error) {
    expect(error).toMatchObject({ code, exitCode });
    return;
  }
  throw new Error(`Expected a ${code} failure`);
}
