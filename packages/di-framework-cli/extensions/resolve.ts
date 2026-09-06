import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CommandFailure,
  type ExtensionManifest,
  type JsonValue,
  validateExtensionManifest,
} from '../command';

/** Entry module of `packageName` as resolved from `fromDirectory`, if installed there. */
export function resolveExtensionModulePath(
  fromDirectory: string,
  packageName: string,
): string | undefined {
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
