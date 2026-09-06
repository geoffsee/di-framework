import { dirname } from 'node:path';
import { CommandFailure } from '@di-framework/cli-extension';
import type { WasmcloudDeps } from './deps.js';
import { findUp } from './project.js';
import { invalidUsage, toolFailed } from './support.js';

/** The Pulumi program lives above the app project (see the wasmCloud infra repository). */
export function findInfrastructureRoot(projectRoot: string): string {
  const pulumiFile = findUp(dirname(projectRoot), 'Pulumi.yaml');
  if (pulumiFile === undefined) {
    throw new CommandFailure(
      'WASMCLOUD_INFRA_NOT_FOUND',
      'No Pulumi.yaml found above this project; deploy and destroy target the local wasmCloud profile',
      2,
      { projectRoot },
    );
  }
  return dirname(pulumiFile);
}

/** Local file backend and passphrase defaults, without touching the caller's environment. */
export function pulumiEnvironment(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...env,
    PULUMI_BACKEND_URL: env.PULUMI_BACKEND_URL ?? 'file://~',
    PULUMI_CONFIG_PASSPHRASE: env.PULUMI_CONFIG_PASSPHRASE ?? 'local-dev',
  };
}

export function pulumiStack(env: Record<string, string | undefined>): string {
  return env.DI_FRAMEWORK_STACK ?? 'dev';
}

export async function runPulumi(
  deps: WasmcloudDeps,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  const result = await deps.runner('pulumi', args, { cwd, env: pulumiEnvironment(deps.env) });
  if (result.exitCode !== 0) {
    throw toolFailed(`pulumi ${args[0]}`, result.exitCode);
  }
}

export function parseYesArgs(args: readonly string[], command: string): { yes: boolean } {
  let yes = false;
  for (const token of args) {
    if (token !== '--yes') {
      invalidUsage(`Unknown option or argument: ${token}`, token, { command });
    }
    if (yes) invalidUsage(`Option may be provided only once: ${token}`, token);
    yes = true;
  }
  return { yes };
}
