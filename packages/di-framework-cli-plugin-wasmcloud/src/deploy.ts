import type { CliIo, CommandResult } from '@di-framework/cli-extension';
import { buildComponent } from './build.js';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { loadProject } from './project.js';
import { findInfrastructureRoot, parseYesArgs, pulumiStack, runPulumi } from './pulumi.js';

export async function runWasmcloudDeploy(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  const { yes } = parseYesArgs(args, 'wasmcloud deploy');
  const project = loadProject(deps.cwd());
  await buildComponent(project, io, deps);
  const infrastructureRoot = findInfrastructureRoot(project.projectRoot);
  const stack = pulumiStack(deps.env);

  io.stdout.write(`Deploying ${project.applicationName} to the local wasmCloud profile...\n`);
  await runPulumi(deps, ['stack', 'select', stack, '--create'], infrastructureRoot);
  await runPulumi(deps, ['up', ...(yes ? ['--yes'] : [])], infrastructureRoot);

  return {
    data: { application: project.applicationName, infrastructureRoot, stack },
    text: `Deployed ${project.applicationName} (stack ${stack}).`,
  };
}
