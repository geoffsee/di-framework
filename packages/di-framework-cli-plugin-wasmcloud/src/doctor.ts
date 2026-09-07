import { relative } from 'node:path';
import type { CliIo, CommandResult } from '@di-framework/cli-extension';
import { DEFAULT_DEPS, type WasmcloudDeps } from './deps.js';
import { loadProject } from './project.js';
import { invalidUsage } from './support.js';

export type DoctorCheck = { name: string; ok: boolean; detail?: string };

export async function runWasmcloudDoctor(
  args: readonly string[],
  _io: CliIo,
  deps: WasmcloudDeps = DEFAULT_DEPS,
): Promise<CommandResult> {
  if (args.length > 0) {
    invalidUsage(`wasmcloud doctor does not accept arguments: ${args[0]}`, args[0] ?? '');
  }
  const project = loadProject(deps.cwd());
  const check = (name: string, detail: string | undefined): DoctorCheck =>
    detail === undefined ? { name, ok: false } : { name, ok: true, detail };
  const checks: DoctorCheck[] = [
    check('Bun', Bun.version),
    check('Node.js', deps.nodeBinaryPath() && deps.capture('node', ['--version'])),
    check('@di-framework/core', deps.resolveFromProject(project.projectRoot, '@di-framework/core')),
    check('@di-framework/http', deps.resolveFromProject(project.projectRoot, '@di-framework/http')),
    check('Pulumi', deps.capture('pulumi', ['version'])),
    check('Docker', deps.capture('docker', ['version', '--format', '{{.Server.Version}}'])),
    check('kubectl', deps.capture('kubectl', ['version', '--client', '--output=yaml'])),
    check('oras', deps.capture('oras', ['version'])),
  ];
  const failed = checks.some((entry) => !entry.ok);
  const lines = [
    `${project.applicationName}`,
    '',
    ...checks.map((entry) =>
      entry.ok ? `✓ ${entry.name}: ${entry.detail}` : `✗ ${entry.name} is unavailable`,
    ),
    '',
    `Contract: incoming HTTP → default export in ${relative(project.projectRoot, project.entryPath)}`,
  ];
  return {
    data: {
      application: project.applicationName,
      checks: checks.map((entry) => ({ ...entry })),
    },
    text: lines.join('\n'),
    exitCode: failed ? 1 : 0,
  };
}
