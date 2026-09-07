import { describe, expect, it } from 'bun:test';
import { loadProject } from '../src/project';
import {
  applyWorkload,
  renderWorkloadManifest,
  WORKLOAD_DEPLOYMENT_RESOURCE,
  waitForReady,
} from '../src/workload';
import { captureIo, fakeDeps, makeWorkspace, type RunnerInvocation } from './helpers';

describe('workload manifests', () => {
  it('renders Service and WorkloadDeployment from the project name and image', () => {
    const { greeter } = makeWorkspace();
    const project = loadProject(greeter);
    const yaml = renderWorkloadManifest(
      project,
      {
        target: 'development',
        kubeconfig: '/tmp/kube',
        namespace: 'wasmcloud',
        registry: 'registry.example.com/team',
      },
      'registry.example.com/team/greeter:sha256-abc',
    );
    expect(yaml).toContain('kind: Service');
    expect(yaml).toContain('kind: WorkloadDeployment');
    expect(yaml).toContain('name: greeter');
    expect(yaml).toContain('registry.example.com/team/greeter:sha256-abc');
    expect(yaml).not.toContain('Pulumi');
  });

  it('treats unparseable kubectl output as not ready and times out', async () => {
    const { greeter } = makeWorkspace();
    const project = loadProject(greeter);
    await expect(
      waitForReady(
        project,
        {
          target: 'development',
          kubeconfig: '/tmp/kube',
          namespace: 'wasmcloud',
          registry: 'registry.example.com/team',
        },
        fakeDeps({
          cwd: greeter,
          capturedStdout: { 'kubectl get': 'not-json' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_DEPLOYMENT_NOT_READY', exitCode: 3 });
  });

  it('accepts the Available condition when readyReplicas is absent', async () => {
    const { greeter } = makeWorkspace();
    const project = loadProject(greeter);
    await waitForReady(
      project,
      {
        target: 'development',
        kubeconfig: '/tmp/kube',
        namespace: 'wasmcloud',
        registry: 'registry.example.com/team',
      },
      fakeDeps({
        cwd: greeter,
        capturedStdout: {
          'kubectl get': JSON.stringify({
            status: { conditions: [{ type: 'Available', status: 'True' }] },
          }),
        },
      }),
    );
  });

  it('times out with WASMCLOUD_DEPLOYMENT_NOT_READY when the workload never becomes ready', async () => {
    const { greeter } = makeWorkspace();
    const project = loadProject(greeter);
    await expect(
      waitForReady(
        project,
        {
          target: 'development',
          kubeconfig: '/tmp/kube',
          namespace: 'wasmcloud',
          registry: 'registry.example.com/team',
        },
        fakeDeps({
          cwd: greeter,
          capturedStdout: { 'kubectl get': '{}' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'WASMCLOUD_DEPLOYMENT_NOT_READY', exitCode: 3 });
  });

  it('applies the generated manifest through kubectl', async () => {
    const { greeter } = makeWorkspace();
    const project = loadProject(greeter);
    const invocations: RunnerInvocation[] = [];
    const path = await applyWorkload(
      project,
      {
        target: 'development',
        kubeconfig: '/tmp/kube',
        namespace: 'wasmcloud',
        registry: 'registry.example.com/team',
      },
      'registry.example.com/team/greeter:sha256-abc',
      captureIo().io,
      fakeDeps({ cwd: greeter, invocations }),
    );
    expect(path).toContain('.di-framework');
    expect(
      invocations.some(
        (invocation) =>
          invocation.command === 'kubectl' &&
          invocation.args.includes('get') &&
          invocation.args.includes(WORKLOAD_DEPLOYMENT_RESOURCE),
      ),
    ).toBe(true);
  });
});
