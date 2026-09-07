import { createHash, type Hash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { type CliIo, CommandFailure, type CommandResult } from '@di-framework/cli-extension';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { loadProject, type WasmcloudProject } from './project.js';
import { invalidUsage, requireNodeBinary, toolFailed } from './support.js';

export const BUILD_PROFILE = 'wasmcloud-http';
export const WASI_HTTP_VERSION = '0.2.12';

export type BuildSummary = {
  application: string;
  artifactDigest: string;
  component: string;
  deploymentDigest: string;
  entry: string;
  profile: string;
};

/** The disposable `.di-framework/` build directory: WIT world, bundle, and manifests. */
export async function buildComponent(
  project: WasmcloudProject,
  io: CliIo,
  deps: WasmcloudDeps,
): Promise<BuildSummary> {
  const generatedDirectory = join(project.projectRoot, '.di-framework');
  const generatedWit = join(generatedDirectory, 'wit');
  const bundledJavaScript = join(generatedDirectory, 'component.js');

  rmSync(generatedDirectory, { recursive: true, force: true });
  mkdirSync(join(generatedWit, 'deps'), { recursive: true });
  mkdirSync(dirname(project.outputPath), { recursive: true });
  cpSync(join(deps.assetsDirectory(), 'wit', 'deps'), join(generatedWit, 'deps'), {
    recursive: true,
  });

  writeFileSync(
    join(generatedWit, 'world.wit'),
    `package local:${project.witName}@${project.version};\n\nworld application {\n  export wasi:http/incoming-handler@${WASI_HTTP_VERSION};\n}\n`,
  );
  writeFileSync(
    join(generatedDirectory, 'oci-config.json'),
    `${JSON.stringify({ architecture: 'wasm', os: 'wasip2' }, null, 2)}\n`,
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
      '-w',
      generatedWit,
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
  );
  const artifactDigest = createHash('sha256')
    .update(readFileSync(project.outputPath))
    .digest('hex');
  const summary: BuildSummary = {
    application: project.applicationName,
    artifactDigest,
    component: relative(project.projectRoot, project.outputPath),
    deploymentDigest,
    entry: relative(project.projectRoot, project.entryPath),
    profile: BUILD_PROFILE,
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
 * WIT, OCI configuration, and pinned build profile instead of the final bytes.
 */
export function canonicalBuildDigest(
  bundledJavaScript: string,
  witDirectory: string,
  ociConfig: string,
): string {
  const hash = createHash('sha256');
  addDigestEntry(hash, 'profile', `${BUILD_PROFILE}\n${WASI_HTTP_VERSION}`);
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
