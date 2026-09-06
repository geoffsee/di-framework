import { describe, expect, it } from 'bun:test';
import { runWasmcloudDoctor } from '../src/doctor';
import { captureIo, fakeDeps, makeProject } from './helpers';

const HEALTHY = {
  resolutions: {
    '@di-framework/core': '/project/node_modules/@di-framework/core/index.js',
    '@di-framework/http': '/project/node_modules/@di-framework/http/index.js',
  },
  captures: {
    node: 'v22.23.2',
    pulumi: 'v3.261.0',
    docker: '27.0.3',
    kubectl: 'clientVersion:',
  },
};

describe('runWasmcloudDoctor', () => {
  it('reports success when the project and toolchain are complete', async () => {
    const root = makeProject();
    const result = await runWasmcloudDoctor(
      [],
      captureIo().io,
      fakeDeps({ cwd: root, ...HEALTHY }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({ application: 'Demo App' });
    const checks = (result.data as { checks: Array<{ name: string; ok: boolean }> }).checks;
    expect(checks.map((check) => check.name)).toEqual([
      'Bun',
      'Node.js',
      '@di-framework/core',
      '@di-framework/http',
      'Pulumi',
      'Docker',
      'kubectl',
    ]);
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(result.text).toContain('✓ Pulumi: v3.261.0');
    expect(result.text).toContain('Contract: incoming HTTP → default export in src/app.ts');
  });

  it('fails with exit 1 when tools or framework packages are missing', async () => {
    const root = makeProject();
    const result = await runWasmcloudDoctor(
      [],
      captureIo().io,
      fakeDeps({ cwd: root, captures: { pulumi: 'v3.261.0' } }),
    );
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain('✗ Docker is unavailable');
    expect(result.text).toContain('✗ @di-framework/core is unavailable');
  });

  it('rejects arguments', async () => {
    await expect(
      runWasmcloudDoctor(['--fix'], captureIo().io, fakeDeps({ cwd: '/nowhere' })),
    ).rejects.toMatchObject({ code: 'INVALID_USAGE', exitCode: 2 });
  });
});
