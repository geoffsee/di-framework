import type { CommandNode } from '@di-framework/cli-extension';
import { runWasmcloudBuild } from './build.js';
import { runWasmcloudDeploy } from './deploy.js';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { runWasmcloudDestroy } from './destroy.js';
import { runWasmcloudDev } from './dev.js';
import { runWasmcloudDoctor } from './doctor.js';

export function createWasmcloudCommand(deps: WasmcloudDeps = DEFAULT_DEPS): CommandNode {
  return {
    description: 'Build, serve, and deploy DI Framework apps as wasmCloud components',
    children: {
      build: {
        description: 'Bundle the app entry and componentize it for WASI HTTP',
        usage: 'di-framework wasmcloud build',
        run: ({ args, io }) => runWasmcloudBuild(args, io, deps),
      },
      dev: {
        description: 'Build, then serve the component locally with jco',
        usage: 'di-framework wasmcloud dev [--host <address>] [--port <port>]',
        options: [
          '--host <address>  Bind address (default: 127.0.0.1)',
          '--port <port>  Listen port (default: 8000)',
        ],
        run: ({ args, io }) => runWasmcloudDev(args, io, deps),
      },
      deploy: {
        description: 'Build, then deploy via the Pulumi program above the project',
        usage: 'di-framework wasmcloud deploy [--yes]',
        options: ['--yes  Skip the Pulumi confirmation prompt'],
        run: ({ args, io }) => runWasmcloudDeploy(args, io, deps),
      },
      destroy: {
        description: 'Destroy the deployed Pulumi stack',
        usage: 'di-framework wasmcloud destroy [--yes]',
        options: ['--yes  Skip the Pulumi confirmation prompt'],
        run: ({ args, io }) => runWasmcloudDestroy(args, io, deps),
      },
      doctor: {
        description: 'Check the project and local toolchain for wasmCloud readiness',
        usage: 'di-framework wasmcloud doctor',
        run: ({ args, io }) => runWasmcloudDoctor(args, io, deps),
      },
    },
  };
}
