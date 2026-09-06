import type { CliIo, CommandResult } from '@di-framework/cli-extension';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { loadProject } from './project.js';
import { findInfrastructureRoot, parseYesArgs, pulumiStack, runPulumi } from './pulumi.js';

export async function runWasmcloudDestroy(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  const { yes } = parseYesArgs(args, 'wasmcloud destroy');
  const project = loadProject(deps.cwd());
  const infrastructureRoot = findInfrastructureRoot(project.projectRoot);
  const stack = pulumiStack(deps.env);

  io.stdout.write(`Destroying stack ${stack}...\n`);
  await runPulumi(deps, ['stack', 'select', stack], infrastructureRoot);
  await runPulumi(deps, ['destroy', ...(yes ? ['--yes'] : [])], infrastructureRoot);

  return {
    data: { application: project.applicationName, infrastructureRoot, stack },
    text: `Destroyed stack ${stack}.`,
  };
}
