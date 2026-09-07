import type { CliIo, CommandResult } from '@di-framework/cli-extension';
import { parseAppCommandArgs } from './args.js';
import { buildComponent } from './build.js';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { resolveApplication } from './discovery.js';
import { loadDeployManifest } from './manifest.js';
import { publishComponent } from './publish.js';
import { resolveConnection, resolveTarget } from './target.js';
import { applyWorkload, deploymentResourceName } from './workload.js';

export async function runWasmcloudDeploy(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  const options = parseAppCommandArgs(args, 'wasmcloud deploy');
  const manifest = loadDeployManifest(deps.cwd(), deps.env);
  const target = resolveTarget(manifest, options.target);
  const project = resolveApplication(
    deps.cwd(),
    options.name,
    manifest.workspaceRoot,
    manifest.discovery,
  );
  await buildComponent(project, io, deps);
  const connection = await resolveConnection(target, manifest.workspaceRoot, manifest.path, deps);

  io.stdout.write(`Deploying ${project.applicationName} to target ${connection.target}...\n`);
  const image = await publishComponent(project, connection, io, deps);
  await applyWorkload(project, connection, image.reference, io, deps);
  const service = deploymentResourceName(project);

  return {
    data: {
      application: project.applicationName,
      target: connection.target,
      namespace: connection.namespace,
      registry: connection.registry,
      image: image.reference,
      digest: image.digest,
      service,
      ...(connection.endpoints === undefined ? {} : { endpoints: connection.endpoints }),
    },
    text: `Deployed ${project.applicationName} to ${connection.target} (namespace ${connection.namespace}, ${image.reference}).`,
  };
}
