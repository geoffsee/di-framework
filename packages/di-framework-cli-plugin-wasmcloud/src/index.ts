import { defineExtension } from '@di-framework/cli-extension';
import { createWasmcloudCommand } from './command.js';

export { parseAppCommandArgs, parsePlatformCommandArgs, parsePlatformInitArgs } from './args.js';
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
export {
  discoverProjects,
  findConfigFiles,
  resolveApplication,
} from './discovery.js';
export { runWasmcloudDoctor } from './doctor.js';
export {
  DEPLOY_MANIFEST_NAME,
  type DeployManifest,
  type DeployTarget,
  loadDeployManifest,
  parseDeployManifest,
} from './manifest.js';
export {
  loadPlatformOutputs,
  PLATFORM_OUTPUT_SCHEMA_VERSION,
  type PlatformOutputs,
  resolvePlatformDirectory,
  runWasmcloudPlatformDeploy,
  runWasmcloudPlatformDestroy,
} from './platform.js';
export {
  LOCAL_PLATFORM_PATH,
  PLATFORM_START_COMMAND,
  runWasmcloudPlatformInit,
} from './platform-init.js';
export {
  asWitIdentifier,
  CONFIG_FILE_NAME,
  findUp,
  loadProject,
  resolveInside,
  type WasmcloudProject,
} from './project.js';
export { contentDigest, ociReference, publishComponent } from './publish.js';
export { pulumiEnvironment, runPulumi } from './pulumi.js';
export { resolveConnection, resolveTarget } from './target.js';
export {
  applyWorkload,
  deleteWorkload,
  renderWorkloadManifest,
} from './workload.js';

export default defineExtension({
  schemaVersion: 1,
  name: 'wasmcloud',
  description: 'Build, serve, and deploy DI Framework apps as wasmCloud components',
  command: createWasmcloudCommand(),
});
