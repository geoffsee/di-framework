import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CommandFailure,
  type ExtensionManifest,
  type JsonValue,
  validateExtensionManifest,
} from '../command';

/** True when `packageName` exists in a node_modules directory at or above `fromDirectory`. */
function packageInstalledNearby(fromDirectory: string, packageName: string): boolean {
  let previous = '';
  let current = resolve(fromDirectory);
  while (current !== previous) {
    if (existsSync(join(current, 'node_modules', ...packageName.split('/')))) return true;
    previous = current;
    current = dirname(current);
  }
  return false;
}

/** Entry module of `packageName` as resolved from `fromDirectory`, if installed there. */
export function resolveExtensionModulePath(
  fromDirectory: string,
  packageName: string,
): string | undefined {
  // Bun's require.resolve can fall back to its global install cache when the
  // directory is not a real project; only a package physically present in a
  // reachable node_modules tree counts as installed here.
  if (!packageInstalledNearby(fromDirectory, packageName)) return undefined;
  try {
    return createRequire(join(fromDirectory, 'package.json')).resolve(packageName);
  } catch {
    return undefined;
  }
}

/** Import an extension module and structurally validate its default-export manifest. */
export async function loadExtensionManifest(
  modulePath: string,
  packageName: string,
): Promise<ExtensionManifest> {
  let loaded: { default?: unknown };
  try {
    loaded = await import(pathToFileURL(modulePath).href);
  } catch (cause) {
    throw new CommandFailure(
      'EXTENSION_LOAD_FAILED',
      `Unable to load extension package ${packageName}`,
      3,
      { package: packageName, cause: cause instanceof Error ? cause.message : String(cause) },
    );
  }
  const manifest = loaded.default;
  const issues = validateExtensionManifest(manifest);
  if (issues.length > 0) {
    throw new CommandFailure(
      'EXTENSION_MANIFEST_INVALID',
      `Extension package ${packageName} has an invalid manifest`,
      3,
      { package: packageName, issues: issues as unknown as JsonValue },
    );
  }
  return manifest as ExtensionManifest;
}

/** The manifest name is the dispatch convention; a mismatch breaks `di-framework <name>`. */
export function ensureManifestMatchesPackage(
  manifest: ExtensionManifest,
  packageName: string,
  expectedName: string,
): void {
  if (manifest.name !== expectedName) {
    throw new CommandFailure(
      'EXTENSION_NAME_MISMATCH',
      `Extension package ${packageName} declares name "${manifest.name}" but its package name requires "${expectedName}"`,
      3,
      { package: packageName, manifestName: manifest.name, expectedName },
    );
  }
}
