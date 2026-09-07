import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runWasmcloudDeploy } from '../src/deploy';
import { contentDigest, ociReference } from '../src/publish';
import {
  captureIo,
  fakeDeps,
  makeWorkspace,
  platformOutputJson,
  type RunnerInvocation,
} from './helpers';

describe('runWasmcloudDeploy', () => {
  it('deploys the nearest project to a kubeconfig-only target', async () => {
    const { root, greeter, kubeconfig } = makeWorkspace();
    const invocations: RunnerInvocation[] = [];
    const result = await runWasmcloudDeploy(
      ['--target', 'development'],
      captureIo().io,
      fakeDeps({ cwd: greeter, invocations }),
    );

    expect(invocations.some((invocation) => invocation.command === 'pulumi')).toBe(false);
    expect(invocations.some((invocation) => invocation.command === 'oras')).toBe(true);
    expect(invocations.some((invocation) => invocation.args.includes('apply'))).toBe(true);
    const wasm = join(greeter, 'dist', 'greeter.wasm');
    const digest = contentDigest(wasm);
    expect(result.data).toMatchObject({
      application: 'greeter',
      target: 'development',
      namespace: 'wasmcloud',
      image: `registry.example.com/team/greeter:sha256-${digest}`,
      service: 'greeter',
    });
    expect(existsSync(join(greeter, '.di-framework', 'deploy', 'workload.yaml'))).toBe(true);
    const yaml = readFileSync(join(greeter, '.di-framework', 'deploy', 'workload.yaml'), 'utf8');
    expect(yaml).toContain('kind: WorkloadDeployment');
    expect(yaml).toContain('kind: Service');
    expect(yaml).not.toContain('apps');
    expect(invocations.find((invocation) => invocation.command === 'oras')?.args).toContain(
      `registry.example.com/team/greeter:sha256-${digest}`,
    );
    expect(kubeconfig.length).toBeGreaterThan(0);
    expect(root).toBeTruthy();
  });

  it('resolves greeter from the workspace root and another directory', async () => {
    const { root, echo, kubeconfig } = makeWorkspace();
    const fromRoot = await runWasmcloudDeploy(
      ['greeter', '--target', 'development'],
      captureIo().io,
      fakeDeps({ cwd: root }),
    );
    expect(fromRoot.data).toMatchObject({ application: 'greeter', target: 'development' });

    const fromEcho = await runWasmcloudDeploy(
      ['greeter', '--target', 'development'],
      captureIo().io,
      fakeDeps({ cwd: echo }),
    );
    expect(fromEcho.data).toMatchObject({ application: 'greeter' });
    expect(kubeconfig).toBeTruthy();
  });

  it('uses managed Pulumi outputs instead of deploying the platform', async () => {
    const { root, greeter, kubeconfig } = makeWorkspace();
    const invocations: RunnerInvocation[] = [];
    const result = await runWasmcloudDeploy(
      [],
      captureIo().io,
      fakeDeps({
        cwd: greeter,
        invocations,
        capturedStdout: { 'pulumi stack output': platformOutputJson(kubeconfig) },
      }),
    );
    expect(
      invocations.filter((invocation) => invocation.command === 'pulumi').map((i) => i.args),
    ).toEqual([
      ['stack', 'select', 'dev'],
      ['stack', 'output', '--json'],
    ]);
    expect(invocations.some((invocation) => invocation.args[0] === 'up')).toBe(false);
    expect(invocations.some((invocation) => invocation.args[0] === 'destroy')).toBe(false);
    expect(result.data).toMatchObject({
      application: 'greeter',
      target: 'local',
      registry: 'localhost:5000/di-framework',
    });
    expect(root).toBeTruthy();
  });

  it('maps oras and kubectl failures to WASMCLOUD_TOOL_FAILED', async () => {
    const { greeter } = makeWorkspace();
    await expect(
      runWasmcloudDeploy(
        ['--target', 'development'],
        captureIo().io,
        fakeDeps({ cwd: greeter, exitCodes: { 'oras push': 1 } }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_TOOL_FAILED', exitCode: 3 });

    await expect(
      runWasmcloudDeploy(
        ['--target', 'development'],
        captureIo().io,
        fakeDeps({ cwd: greeter, exitCodes: { 'kubectl apply': 1 } }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_TOOL_FAILED', exitCode: 3 });
  });

  it('derives an immutable digest from component bytes', () => {
    const { greeter } = makeWorkspace();
    const wasm = join(greeter, 'component.wasm');
    writeFileSync(wasm, 'abc');
    expect(contentDigest(wasm)).toBe(createHash('sha256').update('abc').digest('hex'));
  });

  it('normalizes registry hosts without a trailing-slash regular expression', () => {
    expect(ociReference('registry.example.com///', 'greeter', 'abc')).toBe(
      'registry.example.com/greeter:sha256-abc',
    );
    expect(ociReference('https://registry.example.com/', 'greeter', 'abc')).toBe(
      'registry.example.com/greeter:sha256-abc',
    );
    expect(ociReference('http://localhost:5000', 'greeter', 'abc')).toBe(
      'localhost:5000/greeter:sha256-abc',
    );
  });
});
