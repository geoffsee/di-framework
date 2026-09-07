import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { CliIo } from '@di-framework/cli-extension';
import type { WasmcloudDeps } from './deps.js';
import type { WasmcloudProject } from './project.js';
import { toolFailed } from './support.js';
import type { ClusterConnection } from './target.js';

export type PublishedImage = {
  digest: string;
  reference: string;
};

export function contentDigest(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function ociReference(registry: string, repository: string, digest: string): string {
  return `${normalizeRegistryHost(registry)}/${repository}:sha256-${digest}`;
}

function normalizeRegistryHost(registry: string): string {
  let host = registry;
  const lower = host.toLowerCase();
  if (lower.startsWith('https://')) host = host.slice('https://'.length);
  else if (lower.startsWith('http://')) host = host.slice('http://'.length);
  while (host.endsWith('/')) host = host.slice(0, -1);
  return host;
}

export async function publishComponent(
  project: WasmcloudProject,
  connection: ClusterConnection,
  io: CliIo,
  deps: WasmcloudDeps,
): Promise<PublishedImage> {
  const digest = contentDigest(project.outputPath);
  const reference = ociReference(connection.registry, project.witName, digest);
  const configPath = join(project.projectRoot, '.di-framework', 'oci-config.json');
  io.stdout.write(
    `Publishing ${relative(project.projectRoot, project.outputPath)} as ${reference}...\n`,
  );
  const pushed = await deps.runner(
    'oras',
    [
      'push',
      '--config',
      `${configPath}:application/vnd.wasm.config.v0+json`,
      reference,
      `${project.outputPath}:application/wasm`,
    ],
    { cwd: project.projectRoot },
  );
  if (pushed.exitCode !== 0) {
    throw toolFailed('oras push', pushed.exitCode);
  }
  return { digest, reference };
}
