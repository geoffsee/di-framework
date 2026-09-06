import { defineExtension } from '@di-framework/cli-extension';
import { createWasmcloudCommand } from './command.js';

export { BUILD_PROFILE, buildComponent, runWasmcloudBuild, WASI_HTTP_VERSION } from './build.js';
export { createWasmcloudCommand } from './command.js';
export { runWasmcloudDeploy } from './deploy.js';
export {
  DEFAULT_DEPS,
  nodeCompatibilityPlugin,
  type WasmcloudDeps,
} from './deps.js';
export { runWasmcloudDestroy } from './destroy.js';
export { parseDevArgs, runWasmcloudDev } from './dev.js';
export { runWasmcloudDoctor } from './doctor.js';
export {
  asWitIdentifier,
  CONFIG_FILE_NAME,
  findUp,
  loadProject,
  resolveInside,
  type WasmcloudProject,
} from './project.js';
export {
  findInfrastructureRoot,
  parseYesArgs,
  pulumiEnvironment,
  pulumiStack,
  runPulumi,
} from './pulumi.js';

export default defineExtension({
  schemaVersion: 1,
  name: 'wasmcloud',
  description: 'Build, serve, and deploy DI Framework apps as wasmCloud components',
  command: createWasmcloudCommand(),
});
