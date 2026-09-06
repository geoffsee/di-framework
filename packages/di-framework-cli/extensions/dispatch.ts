import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CommandNode, EXTENSION_NAME_PATTERN } from '../command';
import { candidatePackageNames, deriveCommandName } from './names';
import {
  ensureManifestMatchesPackage,
  loadExtensionManifest,
  resolveExtensionModulePath,
} from './resolve';
import { extensionsStoreDirectory, installedExtensionPackages } from './store';

export type ExtensionDispatch = {
  /** Command tree for `di-framework <token>` when an installed extension provides it. */
  resolveCommand(token: string, cwd: string): Promise<CommandNode | undefined>;
  /** Placeholder children so root help lists installed extensions without importing them. */
  installedStubs(cwd: string): Record<string, CommandNode>;
};

function projectExtensionPackages(cwd: string): string[] {
  try {
    const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ].filter((name) => deriveCommandName(name) !== undefined);
  } catch {
    return [];
  }
}

export function createExtensionDispatch(storeDirectory?: string): ExtensionDispatch {
  const resolveStore = () => storeDirectory ?? extensionsStoreDirectory();
  return {
    async resolveCommand(token, cwd) {
      if (!EXTENSION_NAME_PATTERN.test(token)) return undefined;
      const store = resolveStore();
      const sources = [
        { directory: cwd, installed: projectExtensionPackages(cwd) },
        { directory: store, installed: installedExtensionPackages(store) },
      ];
      for (const source of sources) {
        for (const packageName of candidatePackageNames(token, source.installed)) {
          const modulePath = resolveExtensionModulePath(source.directory, packageName);
          if (modulePath === undefined) continue;
          try {
            const manifest = await loadExtensionManifest(modulePath, packageName);
            ensureManifestMatchesPackage(manifest, packageName, token);
            return manifest.command;
          } catch (failure) {
            // Mount a node that reports the failure through the standard envelope.
            return {
              description: `${packageName} (unavailable extension)`,
              run: () => {
                throw failure;
              },
            };
          }
        }
      }
      return undefined;
    },
    installedStubs(cwd) {
      const stubs: Record<string, CommandNode> = {};
      const addStub = (packageName: string) => {
        const name = deriveCommandName(packageName);
        if (name !== undefined && stubs[name] === undefined) {
          stubs[name] = {
            description: `${packageName} (installed extension)`,
            run: () => undefined,
          };
        }
      };
      for (const packageName of projectExtensionPackages(cwd)) addStub(packageName);
      for (const packageName of installedExtensionPackages(resolveStore())) addStub(packageName);
      return stubs;
    },
  };
}

export const DEFAULT_EXTENSION_DISPATCH: ExtensionDispatch = createExtensionDispatch();
