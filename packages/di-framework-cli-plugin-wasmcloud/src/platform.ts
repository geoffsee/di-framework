import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CliIo, CommandResult } from '@di-framework/cli-extension';
import { CommandFailure } from '@di-framework/cli-extension';
import { parsePlatformCommandArgs } from './args.js';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { loadDeployManifest, type ManagedTarget } from './manifest.js';
import { resolveInsideRoot } from './paths.js';
import { pulumiEnvironment, runPulumi } from './pulumi.js';

export const PLATFORM_OUTPUT_SCHEMA_VERSION = 1;

export type PlatformEndpoints = {
  http?: string;
  kubernetes?: string;
  registry?: string;
};

export type PlatformOutputs = {
  schemaVersion: typeof PLATFORM_OUTPUT_SCHEMA_VERSION;
  kubeconfig: string;
  namespace: string;
  registry: string;
  context?: string;
  endpoints?: PlatformEndpoints;
};

export async function runWasmcloudPlatformDeploy(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  const options = parsePlatformCommandArgs(args, 'wasmcloud platform deploy');
  const { target, platformRoot, stack } = loadManagedPlatform(deps, options.target);
  io.stdout.write(`Deploying platform target ${target.name} (stack ${stack})...\n`);
  await runPulumi(deps, ['stack', 'select', stack, '--create'], platformRoot);
  await runPulumi(deps, ['up', ...(options.yes ? ['--yes'] : [])], platformRoot);
  const outputs = await loadPlatformOutputs(deps, platformRoot, stack, target.name);
  return {
    data: {
      target: target.name,
      stack,
      platformRoot,
      namespace: outputs.namespace,
      registry: outputs.registry,
    },
    text: `Platform target ${target.name} is up (stack ${stack}).`,
  };
}

export async function runWasmcloudPlatformDestroy(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  const options = parsePlatformCommandArgs(args, 'wasmcloud platform destroy');
  const { target, platformRoot, stack } = loadManagedPlatform(deps, options.target);
  io.stdout.write(`Destroying platform target ${target.name} (stack ${stack})...\n`);
  await runPulumi(deps, ['stack', 'select', stack], platformRoot);
  await runPulumi(deps, ['destroy', ...(options.yes ? ['--yes'] : [])], platformRoot);
  return {
    data: { target: target.name, stack, platformRoot },
    text: `Destroyed platform target ${target.name} (stack ${stack}).`,
  };
}

export async function loadPlatformOutputs(
  deps: WasmcloudDeps,
  platformRoot: string,
  stack: string,
  targetName: string,
): Promise<PlatformOutputs> {
  await runPulumi(deps, ['stack', 'select', stack], platformRoot);
  const result = await deps.runCaptured('pulumi', ['stack', 'output', '--json'], {
    cwd: platformRoot,
    env: pulumiEnvironment(deps.env),
  });
  if (result.exitCode !== 0) {
    throw new CommandFailure(
      'WASMCLOUD_PLATFORM_NOT_READY',
      `Managed target "${targetName}" did not produce stack outputs. Deploy the platform first with: di-framework wasmcloud platform deploy ${targetName}`,
      3,
      { target: targetName, stack, platformRoot, exitCode: result.exitCode },
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch (error) {
    throw invalidOutputs(
      targetName,
      `pulumi stack output --json was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return materializeOutputs(raw, targetName, platformRoot);
}

export function resolvePlatformDirectory(
  target: ManagedTarget,
  workspaceRoot: string,
  manifestPath: string,
): string {
  const resolved = resolveInsideRoot(workspaceRoot, target.platform);
  if (!resolved.ok) {
    throw new CommandFailure(
      'WASMCLOUD_DEPLOY_MANIFEST_INVALID',
      `Target "${target.name}" platform "${target.platform}" must be a directory inside the workspace`,
      2,
      { target: target.name, platform: target.platform, manifestPath },
    );
  }
  const pulumiFile = join(resolved.path, 'Pulumi.yaml');
  if (!existsSync(pulumiFile)) {
    throw new CommandFailure(
      'WASMCLOUD_PLATFORM_NOT_FOUND',
      `Managed target "${target.name}" platform ${resolved.path} has no Pulumi.yaml. Point platform at a Pulumi project that provisions only the wasmCloud platform.`,
      2,
      { target: target.name, platformRoot: resolved.path },
    );
  }
  return resolved.path;
}

function loadManagedPlatform(deps: WasmcloudDeps, targetName: string) {
  const manifest = loadDeployManifest(deps.cwd(), deps.env);
  const target = manifest.targets[targetName];
  if (target === undefined) {
    throw new CommandFailure(
      'WASMCLOUD_TARGET_NOT_FOUND',
      `Unknown target "${targetName}". Known targets: ${Object.keys(manifest.targets).join(', ')}`,
      2,
      { target: targetName, targets: Object.keys(manifest.targets), manifestPath: manifest.path },
    );
  }
  if (target.kind !== 'managed') {
    throw new CommandFailure(
      'WASMCLOUD_TARGET_INVALID',
      `Target "${target.name}" is kubeconfig-only and has no managed platform to deploy or destroy.`,
      2,
      { target: target.name },
    );
  }
  const platformRoot = resolvePlatformDirectory(target, manifest.workspaceRoot, manifest.path);
  return { manifest, target, platformRoot, stack: target.stack };
}

function materializeOutputs(
  raw: unknown,
  targetName: string,
  platformRoot: string,
): PlatformOutputs {
  if (!isRecord(raw)) {
    throw invalidOutputs(targetName, 'stack outputs must be a JSON object');
  }

  const kubeconfig = requiredString(raw.kubeconfig, 'kubeconfig', targetName);
  const namespace = requiredString(raw.namespace, 'namespace', targetName);
  const registry = requiredString(raw.registry, 'registry', targetName);
  const context =
    raw.context === undefined ? undefined : requiredString(raw.context, 'context', targetName);
  const endpoints = parseEndpoints(raw.endpoints, targetName);

  let kubeconfigPath = kubeconfig;
  if (kubeconfig.includes('\n') || kubeconfig.includes('apiVersion:')) {
    const generated = join(platformRoot, '.di-framework');
    mkdirSync(generated, { recursive: true });
    kubeconfigPath = join(generated, 'kubeconfig.yaml');
    writeFileSync(kubeconfigPath, kubeconfig.endsWith('\n') ? kubeconfig : `${kubeconfig}\n`);
  }

  return {
    schemaVersion: PLATFORM_OUTPUT_SCHEMA_VERSION,
    kubeconfig: kubeconfigPath,
    namespace,
    registry,
    context,
    endpoints,
  };
}

function parseEndpoints(value: unknown, targetName: string): PlatformEndpoints | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw invalidOutputs(targetName, 'endpoints must be an object when present');
  }
  const http =
    value.http === undefined ? undefined : requiredString(value.http, 'endpoints.http', targetName);
  const kubernetes =
    value.kubernetes === undefined
      ? undefined
      : requiredString(value.kubernetes, 'endpoints.kubernetes', targetName);
  const registry =
    value.registry === undefined
      ? undefined
      : requiredString(value.registry, 'endpoints.registry', targetName);
  return { http, kubernetes, registry };
}

function requiredString(value: unknown, field: string, targetName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidOutputs(
      targetName,
      `missing required output "${field}". The platform Pulumi program must export kubeconfig, namespace, and registry.`,
    );
  }
  return value;
}

function invalidOutputs(targetName: string, message: string): CommandFailure {
  return new CommandFailure(
    'WASMCLOUD_PLATFORM_OUTPUT_INVALID',
    `Platform target "${targetName}" output contract is invalid: ${message}`,
    2,
    { target: targetName, schemaVersion: PLATFORM_OUTPUT_SCHEMA_VERSION },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
