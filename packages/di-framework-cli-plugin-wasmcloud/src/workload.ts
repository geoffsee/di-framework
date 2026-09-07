import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CliIo, CommandFailure } from '@di-framework/cli-extension';
import type { WasmcloudDeps } from './deps.js';
import { captureKubectl, runKubectl } from './kubernetes.js';
import type { WasmcloudProject } from './project.js';
import type { ClusterConnection } from './target.js';

export const MANAGED_BY_LABEL = 'di-framework';
export const WAIT_ATTEMPTS = 30;
export const WAIT_INTERVAL_MS = 2_000;
export const WORKLOAD_DEPLOYMENT_RESOURCE = 'workloaddeployment.runtime.wasmcloud.dev';

export function deploymentResourceName(project: WasmcloudProject): string {
  return project.witName;
}

export function generatedManifestPath(project: WasmcloudProject): string {
  return join(project.projectRoot, '.di-framework', 'deploy', 'workload.yaml');
}

export function renderWorkloadManifest(
  project: WasmcloudProject,
  connection: ClusterConnection,
  image: string,
): string {
  const name = deploymentResourceName(project);
  const labels = [
    `    app.kubernetes.io/managed-by: ${MANAGED_BY_LABEL}`,
    `    app.kubernetes.io/name: ${name}`,
    `    di-framework.dev/application: ${yamlQuote(project.applicationName)}`,
  ].join('\n');

  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${connection.namespace}
  labels:
${labels}
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
---
apiVersion: runtime.wasmcloud.dev/v1alpha1
kind: WorkloadDeployment
metadata:
  name: ${name}
  namespace: ${connection.namespace}
  labels:
${labels}
spec:
  replicas: 1
  template:
    spec:
      hostSelector:
        hostgroup: default
      kubernetes:
        service:
          name: ${name}
      components:
        - name: ${name}
          image: ${yamlQuote(image)}
      hostInterfaces:
        - namespace: wasi
          package: http
          interfaces:
            - incoming-handler
`;
}

export async function applyWorkload(
  project: WasmcloudProject,
  connection: ClusterConnection,
  image: string,
  io: CliIo,
  deps: WasmcloudDeps,
): Promise<string> {
  const manifest = renderWorkloadManifest(project, connection, image);
  const path = generatedManifestPath(project);
  mkdirSync(join(project.projectRoot, '.di-framework', 'deploy'), { recursive: true });
  writeFileSync(path, manifest);
  const name = deploymentResourceName(project);
  io.stdout.write(`Applying WorkloadDeployment ${name} in ${connection.namespace}...\n`);
  await runKubectl(deps, connection, ['apply', '-f', path], project.projectRoot);
  await waitForReady(project, connection, deps);
  return path;
}

export async function deleteWorkload(
  project: WasmcloudProject,
  connection: ClusterConnection,
  io: CliIo,
  deps: WasmcloudDeps,
): Promise<void> {
  const name = deploymentResourceName(project);
  io.stdout.write(`Removing WorkloadDeployment ${name} from ${connection.namespace}...\n`);
  await runKubectl(
    deps,
    connection,
    ['delete', `${WORKLOAD_DEPLOYMENT_RESOURCE}/${name}`, `service/${name}`, '--ignore-not-found'],
    project.projectRoot,
  );
}

export async function waitForReady(
  project: WasmcloudProject,
  connection: ClusterConnection,
  deps: WasmcloudDeps,
): Promise<void> {
  const name = deploymentResourceName(project);
  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt++) {
    const result = await captureKubectl(
      deps,
      connection,
      ['get', WORKLOAD_DEPLOYMENT_RESOURCE, name, '-o', 'json'],
      project.projectRoot,
    );
    if (result.exitCode === 0 && isReady(result.stdout)) return;
    await deps.wait(WAIT_INTERVAL_MS);
  }
  throw new CommandFailure(
    'WASMCLOUD_DEPLOYMENT_NOT_READY',
    `WorkloadDeployment ${name} in ${connection.namespace} did not become ready`,
    3,
    { application: project.applicationName, namespace: connection.namespace, name },
  );
}

function isReady(stdout: string): boolean {
  try {
    const document = JSON.parse(stdout) as {
      spec?: { replicas?: number };
      status?: {
        readyReplicas?: number;
        conditions?: Array<{ type?: string; status?: string }>;
      };
    };
    const replicas = document.spec?.replicas ?? 1;
    if ((document.status?.readyReplicas ?? 0) >= replicas) return true;
    return (document.status?.conditions ?? []).some(
      (condition) => condition.type === 'Available' && condition.status === 'True',
    );
  } catch {
    return false;
  }
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}
