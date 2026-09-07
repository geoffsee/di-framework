import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildComponent, runWasmcloudBuild } from '../src/build';
import { loadProject } from '../src/project';
import { captureIo, fakeDeps, makeAssets, makeProject, type RunnerInvocation } from './helpers';

describe('buildComponent', () => {
  it('writes the generated WIT world, manifests, bundle, and runs jco componentize', async () => {
    const root = makeProject();
    const assets = makeAssets();
    const invocations: RunnerInvocation[] = [];
    const deps = fakeDeps({ cwd: root, assets, invocations });
    const output = captureIo();

    const summary = await buildComponent(loadProject(root), output.io, deps);

    const generated = join(root, '.di-framework');
    expect(readFileSync(join(generated, 'wit', 'world.wit'), 'utf8')).toBe(
      'package local:demo-app@1.2.3;\n\nworld application {\n  export wasi:http/incoming-handler@0.2.12;\n}\n',
    );
    expect(JSON.parse(readFileSync(join(generated, 'oci-config.json'), 'utf8'))).toEqual({
      architecture: 'wasm',
      os: 'wasip2',
    });
    expect(JSON.parse(readFileSync(join(generated, 'build.json'), 'utf8'))).toEqual({
      schemaVersion: 1,
      application: 'Demo App',
      artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      component: join('dist', 'demo-app.wasm'),
      deploymentDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      entry: join('src', 'app.ts'),
      profile: 'wasmcloud-http',
    });
    expect(existsSync(join(generated, 'wit', 'deps', 'wasi-http', 'package.wit'))).toBe(true);
    expect(existsSync(join(generated, 'component.js'))).toBe(true);

    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({
      command: '/fake/node',
      cwd: root,
      args: [
        '/fake/jco.js',
        'componentize',
        '-w',
        join(generated, 'wit'),
        '-o',
        join(root, 'dist', 'demo-app.wasm'),
        join(generated, 'component.js'),
      ],
    });
    expect(summary).toEqual({
      application: 'Demo App',
      artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      component: join('dist', 'demo-app.wasm'),
      deploymentDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      entry: join('src', 'app.ts'),
      profile: 'wasmcloud-http',
    });
    expect(output.stdout.join('')).toContain('Building Demo App');
    expect(output.stdout.join('')).toContain('Built dist/demo-app.wasm');
  });

  it('keeps the deployment version stable when componentizer bytes vary for identical inputs', async () => {
    const root = makeProject();
    const assets = makeAssets();
    const deps = fakeDeps({
      cwd: root,
      assets,
      componentOutput: (build) => `nondeterministic-component-${build}`,
    });

    const first = await buildComponent(loadProject(root), captureIo().io, deps);
    const second = await buildComponent(loadProject(root), captureIo().io, deps);

    expect(first.artifactDigest).not.toBe(second.artifactDigest);
    expect(first.deploymentDigest).toBe(second.deploymentDigest);
  });

  it('maps bundler failures to WASMCLOUD_BUILD_FAILED', async () => {
    const root = makeProject();
    const deps = fakeDeps({ cwd: root, bundlerError: new Error('rolldown exploded') });
    await expect(buildComponent(loadProject(root), captureIo().io, deps)).rejects.toMatchObject({
      code: 'WASMCLOUD_BUILD_FAILED',
      exitCode: 3,
    });
  });

  it('fails with WASMCLOUD_NODE_REQUIRED when no node binary is available', async () => {
    const root = makeProject();
    const deps = fakeDeps({ cwd: root, nodeBinaryPath: null });
    await expect(buildComponent(loadProject(root), captureIo().io, deps)).rejects.toMatchObject({
      code: 'WASMCLOUD_NODE_REQUIRED',
      exitCode: 3,
    });
  });

  it('maps jco componentize failures to WASMCLOUD_TOOL_FAILED', async () => {
    const root = makeProject();
    const deps = fakeDeps({ cwd: root, exitCodes: { componentize: 1 } });
    await expect(buildComponent(loadProject(root), captureIo().io, deps)).rejects.toMatchObject({
      code: 'WASMCLOUD_TOOL_FAILED',
      exitCode: 3,
    });
  });
});

describe('runWasmcloudBuild', () => {
  it('rejects arguments before touching the project', async () => {
    await expect(
      runWasmcloudBuild(['--watch'], captureIo().io, fakeDeps({ cwd: '/nowhere' })),
    ).rejects.toMatchObject({ code: 'INVALID_USAGE', exitCode: 2 });
  });

  it('builds the project found from the working directory', async () => {
    const root = makeProject();
    const result = await runWasmcloudBuild(
      [],
      captureIo().io,
      fakeDeps({ cwd: join(root, 'src') }),
    );
    expect(result.data).toMatchObject({ application: 'Demo App', profile: 'wasmcloud-http' });
    expect(result.text).toContain('Built');
  });
});
