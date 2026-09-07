import type { WasmcloudDeps } from './deps.js';
import { toolFailed } from './support.js';

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
