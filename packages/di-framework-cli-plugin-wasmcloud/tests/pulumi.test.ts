import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWasmcloudDeploy } from '../src/deploy';
import { runWasmcloudDestroy } from '../src/destroy';
import {
  findInfrastructureRoot,
  parseYesArgs,
  pulumiEnvironment,
  pulumiStack,
} from '../src/pulumi';
import { captureIo, expectFailure, fakeDeps, makeProject, type RunnerInvocation } from './helpers';

/** Project nested under its own temp infra root that carries Pulumi.yaml. */
function makeDeployableProject(): { project: string; infrastructureRoot: string } {
  const infrastructureRoot = mkdtempSync(join(tmpdir(), 'wasmcloud-infra-'));
  writeFileSync(join(infrastructureRoot, 'Pulumi.yaml'), 'name: wasmcloud-k0s\n');
  const project = join(infrastructureRoot, 'app');
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(
    join(project, 'di-framework.config.json'),
    `${JSON.stringify({ name: 'Demo App', entry: 'src/app.ts' })}\n`,
  );
  writeFileSync(
    join(project, 'package.json'),
    `${JSON.stringify({ name: 'demo', version: '1.2.3' })}\n`,
  );
  writeFileSync(join(project, 'src', 'app.ts'), 'export default () => new Response("ok");\n');
  return { project, infrastructureRoot };
}

describe('pulumi helpers', () => {
  it('finds the infrastructure root above the project or fails', () => {
    const { project, infrastructureRoot } = makeDeployableProject();
    expect(findInfrastructureRoot(project)).toBe(infrastructureRoot);

    const isolated = join(makeProject(), 'src');
    mkdirSync(isolated, { recursive: true });
    expectFailure(
      () => findInfrastructureRoot('/definitely/not/a/real/project/root'),
      'WASMCLOUD_INFRA_NOT_FOUND',
      2,
    );
  });

  it('defaults the Pulumi environment without overriding explicit settings', () => {
    const defaulted = pulumiEnvironment({ PATH: '/bin' });
    expect(defaulted.PULUMI_BACKEND_URL).toBe('file://~');
    expect(defaulted.PULUMI_CONFIG_PASSPHRASE).toBe('local-dev');
    expect(defaulted.PATH).toBe('/bin');

    const explicit = pulumiEnvironment({
      PULUMI_BACKEND_URL: 's3://state',
      PULUMI_CONFIG_PASSPHRASE: 'secret',
    });
    expect(explicit.PULUMI_BACKEND_URL).toBe('s3://state');
    expect(explicit.PULUMI_CONFIG_PASSPHRASE).toBe('secret');
  });

  it('selects the stack from the environment', () => {
    expect(pulumiStack({})).toBe('dev');
    expect(pulumiStack({ DI_FRAMEWORK_STACK: 'prod' })).toBe('prod');
  });

  it('parses --yes and rejects everything else', () => {
    expect(parseYesArgs([], 'wasmcloud deploy')).toEqual({ yes: false });
    expect(parseYesArgs(['--yes'], 'wasmcloud deploy')).toEqual({ yes: true });
    expectFailure(() => parseYesArgs(['--force'], 'wasmcloud deploy'), 'INVALID_USAGE', 2);
    expectFailure(() => parseYesArgs(['--yes', '--yes'], 'wasmcloud deploy'), 'INVALID_USAGE', 2);
  });
});

describe('runWasmcloudDeploy', () => {
  it('builds, selects the stack, and runs pulumi up with defaults applied', async () => {
    const { project, infrastructureRoot } = makeDeployableProject();
    const invocations: RunnerInvocation[] = [];
    const output = captureIo();
    const result = await runWasmcloudDeploy(
      ['--yes'],
      output.io,
      fakeDeps({ cwd: project, invocations, env: { DI_FRAMEWORK_STACK: 'staging' } }),
    );

    const pulumiCalls = invocations.filter((invocation) => invocation.command === 'pulumi');
    expect(pulumiCalls.map((invocation) => invocation.args)).toEqual([
      ['stack', 'select', 'staging', '--create'],
      ['up', '--yes'],
    ]);
    expect(pulumiCalls[0]?.cwd).toBe(infrastructureRoot);
    expect(pulumiCalls[0]?.env?.PULUMI_BACKEND_URL).toBe('file://~');
    expect(pulumiCalls[0]?.env?.PULUMI_CONFIG_PASSPHRASE).toBe('local-dev');
    expect(result.data).toMatchObject({ stack: 'staging', infrastructureRoot });
    expect(output.stdout.join('')).toContain('Deploying Demo App');
  });

  it('maps pulumi failures and missing infrastructure to typed failures', async () => {
    const { project } = makeDeployableProject();
    await expect(
      runWasmcloudDeploy(
        [],
        captureIo().io,
        fakeDeps({ cwd: project, exitCodes: { 'pulumi up': 255 } }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_TOOL_FAILED', exitCode: 3 });

    const isolated = makeProject();
    await expect(
      runWasmcloudDeploy([], captureIo().io, fakeDeps({ cwd: isolated })),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_INFRA_NOT_FOUND', exitCode: 2 });
  });
});

describe('runWasmcloudDestroy', () => {
  it('selects the stack and destroys without building', async () => {
    const { project, infrastructureRoot } = makeDeployableProject();
    const invocations: RunnerInvocation[] = [];
    const result = await runWasmcloudDestroy(
      [],
      captureIo().io,
      fakeDeps({ cwd: project, invocations }),
    );
    expect(invocations.map((invocation) => invocation.args)).toEqual([
      ['stack', 'select', 'dev'],
      ['destroy'],
    ]);
    expect(invocations.every((invocation) => invocation.command === 'pulumi')).toBe(true);
    expect(invocations[0]?.cwd).toBe(infrastructureRoot);
    expect(result.data).toMatchObject({ stack: 'dev' });
    expect(result.text).toContain('Destroyed stack dev');
  });

  it('passes --yes through and surfaces pulumi failures', async () => {
    const { project } = makeDeployableProject();
    const invocations: RunnerInvocation[] = [];
    await runWasmcloudDestroy(['--yes'], captureIo().io, fakeDeps({ cwd: project, invocations }));
    expect(invocations[1]?.args).toEqual(['destroy', '--yes']);

    await expect(
      runWasmcloudDestroy(
        [],
        captureIo().io,
        fakeDeps({ cwd: project, exitCodes: { 'pulumi destroy': 1 } }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_TOOL_FAILED', exitCode: 3 });
  });
});
