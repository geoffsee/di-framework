import { createHash, type Hash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { type CliIo, CommandFailure, type CommandResult } from '@di-framework/cli-extension';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { OCI_ARTIFACT_PLATFORM } from './oci.js';
import { loadProject, type WasmcloudProject } from './project.js';
import { invalidUsage, requireNodeBinary, toolFailed } from './support.js';
import {
  buildWitLock,
  COMPONENT_MODEL,
  defaultProjectRequirements,
  digestBytes,
  renderWorldWit,
  WASI_HTTP_INTERFACE,
  WASI_HTTP_VERSION,
  type WitLock,
  type WitRequirement,
} from './wit.js';

export { COMPONENT_MODEL, WASI_HTTP_INTERFACE, WASI_HTTP_VERSION };
export const BUILD_PROFILE_NAME = 'wasmcloud-http';
export { BUILD_PROFILE_NAME as BUILD_PROFILE };

export type BuildSummary = {
  application: string;
  artifactDigest: string;
  component: string;
  componentModel: string;
  deploymentDigest: string;
  entry: string;
  profile: string;
};

export function requirementsForProject(_project: WasmcloudProject): WitRequirement[] {
  return defaultProjectRequirements();
}

/** The disposable `.di-framework/` build directory: WIT world, bundle, and manifests. */
export async function buildComponent(
  project: WasmcloudProject,
  io: CliIo,
  deps: WasmcloudDeps,
): Promise<BuildSummary> {
  const generatedDirectory = join(project.projectRoot, '.di-framework');
  const generatedWit = join(generatedDirectory, 'wit');
  const bundledJavaScript = join(generatedDirectory, 'component.js');
  const requirements = requirementsForProject(project);

  rmSync(generatedDirectory, { recursive: true, force: true });
  mkdirSync(join(generatedWit, 'deps'), { recursive: true });
  mkdirSync(dirname(project.outputPath), { recursive: true });
  cpSync(join(deps.assetsDirectory(), 'wit', 'deps'), join(generatedWit, 'deps'), {
    recursive: true,
  });

  writeFileSync(
    join(generatedWit, 'world.wit'),
    renderWorldWit(project.witName, project.version, requirements),
  );
  const lock = buildWitLock(requirements, join(generatedWit, 'deps'));
  writeFileSync(join(generatedDirectory, 'wit.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(
    join(generatedDirectory, 'oci-config.json'),
    `${JSON.stringify(OCI_ARTIFACT_PLATFORM, null, 2)}\n`,
  );

  io.stdout.write(`Building ${project.applicationName}...\n`);
  try {
    await deps.bundler({
      adapterPath: join(deps.assetsDirectory(), 'http-adapter.js'),
      entryPath: project.entryPath,
      outFile: bundledJavaScript,
    });
  } catch (error) {
    throw new CommandFailure(
      'WASMCLOUD_BUILD_FAILED',
      `Bundling failed: ${error instanceof Error ? error.message : String(error)}`,
      3,
      { entry: relative(project.projectRoot, project.entryPath) },
    );
  }

  const componentize = await deps.runner(
    requireNodeBinary(deps.nodeBinaryPath()),
    [
      deps.jcoCliPath(),
      'componentize',
      '--backend',
      'qjs',
      '-w',
      generatedWit,
      '-n',
      'application',
      '-o',
      project.outputPath,
      bundledJavaScript,
    ],
    { cwd: project.projectRoot },
  );
  if (componentize.exitCode !== 0) {
    throw toolFailed('jco componentize', componentize.exitCode);
  }

  const deploymentDigest = canonicalBuildDigest(
    bundledJavaScript,
    generatedWit,
    join(generatedDirectory, 'oci-config.json'),
    lock,
  );
  const artifactDigest = digestBytes(readFileSync(project.outputPath));
  const summary: BuildSummary = {
    application: project.applicationName,
    artifactDigest,
    component: relative(project.projectRoot, project.outputPath),
    componentModel: COMPONENT_MODEL,
    deploymentDigest,
    entry: relative(project.projectRoot, project.entryPath),
    profile: BUILD_PROFILE_NAME,
  };
  writeFileSync(
    join(generatedDirectory, 'build.json'),
    `${JSON.stringify({ schemaVersion: 1, ...summary }, null, 2)}\n`,
  );

  io.stdout.write(`Built ${summary.component}\n`);
  return summary;
}

/**
 * Stable logical version for deployment. ComponentizeJS snapshots can contain
 * nondeterministic engine bytes, so the rollout key is the canonical bundle,
 * WIT lock, OCI configuration, and pinned build profile instead of the final bytes.
 */
export function canonicalBuildDigest(
  bundledJavaScript: string,
  witDirectory: string,
  ociConfig: string,
  lock: WitLock,
): string {
  const hash = createHash('sha256');
  addDigestEntry(hash, 'profile', `${BUILD_PROFILE_NAME}\n${COMPONENT_MODEL}`);
  addDigestEntry(hash, 'wit-lock', JSON.stringify(lock));
  addDigestEntry(hash, 'bundle', readFileSync(bundledJavaScript));
  addDigestEntry(hash, 'oci-config', readFileSync(ociConfig));
  for (const file of listFiles(witDirectory)) {
    const name = relative(witDirectory, file).split(sep).join('/');
    addDigestEntry(hash, `wit/${name}`, readFileSync(file));
  }
  return hash.digest('hex');
}

function addDigestEntry(hash: Hash, name: string, content: string | Buffer): void {
  const bytes = typeof content === 'string' ? Buffer.from(content) : content;
  hash.update(`${name.length}:${name}:${bytes.length}:`);
  hash.update(bytes);
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

export async function runWasmcloudBuild(
  args: readonly string[],
  io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  if (args.length > 0) {
    invalidUsage(`wasmcloud build does not accept arguments: ${args[0]}`, args[0] ?? '');
  }
  const project = loadProject(deps.cwd());
  const summary = await buildComponent(project, io, deps);
  return { data: { ...summary }, text: `Built ${summary.component}` };
}
