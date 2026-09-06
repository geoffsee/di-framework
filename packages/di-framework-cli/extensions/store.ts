import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CommandFailure } from '../command';
import { deriveCommandName, normalizeInstallSpec, RESERVED_COMMAND_NAMES } from './names';
import {
  ensureManifestMatchesPackage,
  loadExtensionManifest,
  resolveExtensionModulePath,
} from './resolve';

/** Package-manager invocation boundary; injectable so tests never spawn real installs. */
export type ExtensionRunner = (
  args: readonly string[],
  cwd: string,
) => Promise<{ exitCode: number; stderr: string }>;

/** Runs `bun <args>`; `process.execPath` is the bun binary hosting this CLI. */
export const DEFAULT_EXTENSION_RUNNER: ExtensionRunner = async (args, cwd) => {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { exitCode, stderr };
};

export type ExtensionStoreOptions = {
  runner?: ExtensionRunner;
  storeDirectory?: string;
};

export type InstalledExtension = {
  name: string;
  package: string;
  version: string;
};

/** User-global store; `DI_FRAMEWORK_EXTENSIONS_DIR` overrides it for tests and CI. */
export function extensionsStoreDirectory(
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): string {
  return env.DI_FRAMEWORK_EXTENSIONS_DIR ?? join(home, '.di-framework', 'extensions');
}

function readJsonFile(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Extension package names declared in the store manifest; empty when no store exists. */
export function installedExtensionPackages(storeDirectory: string): string[] {
  const manifest = readJsonFile(join(storeDirectory, 'package.json'));
  const dependencies = (manifest?.dependencies as Record<string, string> | undefined) ?? {};
  return Object.keys(dependencies).filter((name) => deriveCommandName(name) !== undefined);
}

export function listInstalledExtensions(
  storeDirectory = extensionsStoreDirectory(),
): InstalledExtension[] {
  return installedExtensionPackages(storeDirectory).map((packageName) => {
    const installed = readJsonFile(
      join(storeDirectory, 'node_modules', ...packageName.split('/'), 'package.json'),
    );
    return {
      name: deriveCommandName(packageName) as string,
      package: packageName,
      version: typeof installed?.version === 'string' ? installed.version : 'unknown',
    };
  });
}

function ensureStore(storeDirectory: string): void {
  mkdirSync(storeDirectory, { recursive: true });
  const manifestPath = join(storeDirectory, 'package.json');
  if (!existsSync(manifestPath)) {
    const manifest = { name: 'di-framework-extensions', private: true, dependencies: {} };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

export async function installExtension(
  spec: string,
  options: ExtensionStoreOptions = {},
): Promise<InstalledExtension> {
  const { packageName, commandName, range } = normalizeInstallSpec(spec);
  if (RESERVED_COMMAND_NAMES.includes(commandName)) {
    throw new CommandFailure(
      'EXTENSION_NAME_RESERVED',
      `Extension name "${commandName}" is reserved by a built-in command`,
      2,
      { name: commandName },
    );
  }
  const storeDirectory = options.storeDirectory ?? extensionsStoreDirectory();
  const runner = options.runner ?? DEFAULT_EXTENSION_RUNNER;
  ensureStore(storeDirectory);
  const addSpec = range === undefined ? packageName : `${packageName}@${range}`;
  const added = await runner(['add', addSpec], storeDirectory);
  if (added.exitCode !== 0) {
    throw new CommandFailure('EXTENSION_INSTALL_FAILED', `Unable to install ${addSpec}`, 3, {
      package: packageName,
      stderr: added.stderr,
    });
  }
  try {
    const modulePath = resolveExtensionModulePath(storeDirectory, packageName);
    if (modulePath === undefined) {
      throw new CommandFailure(
        'EXTENSION_LOAD_FAILED',
        `Installed package ${packageName} could not be resolved from the extensions store`,
        3,
        { package: packageName },
      );
    }
    const manifest = await loadExtensionManifest(modulePath, packageName);
    ensureManifestMatchesPackage(manifest, packageName, commandName);
  } catch (failure) {
    await runner(['remove', packageName], storeDirectory);
    throw failure;
  }
  const installed = listInstalledExtensions(storeDirectory).find(
    (extension) => extension.package === packageName,
  );
  return installed ?? { name: commandName, package: packageName, version: 'unknown' };
}

export async function uninstallExtension(
  nameOrPackage: string,
  options: ExtensionStoreOptions = {},
): Promise<InstalledExtension> {
  const storeDirectory = options.storeDirectory ?? extensionsStoreDirectory();
  const runner = options.runner ?? DEFAULT_EXTENSION_RUNNER;
  const installed = listInstalledExtensions(storeDirectory).find(
    (extension) => extension.package === nameOrPackage || extension.name === nameOrPackage,
  );
  if (installed === undefined) {
    throw new CommandFailure(
      'EXTENSION_NOT_INSTALLED',
      `No installed extension matches "${nameOrPackage}"`,
      1,
      { query: nameOrPackage },
    );
  }
  const removed = await runner(['remove', installed.package], storeDirectory);
  if (removed.exitCode !== 0) {
    throw new CommandFailure(
      'EXTENSION_UNINSTALL_FAILED',
      `Unable to remove ${installed.package}`,
      3,
      { package: installed.package, stderr: removed.stderr },
    );
  }
  return installed;
}
