import { CommandFailure, type JsonValue } from '@di-framework/cli-extension';

export function invalidUsage(
  message: string,
  token: string,
  details: Record<string, JsonValue> = {},
): never {
  throw new CommandFailure('INVALID_USAGE', message, 2, { token, ...details });
}

export function readOptionValue(args: readonly string[], position: number, option: string): string {
  const value = args[position];
  if (value == null || value.startsWith('--')) {
    invalidUsage(`Missing value for ${option}`, option);
  }
  return value;
}

/** jco runs under real Node.js only; Bun lacks the node internals it uses. */
export function requireNodeBinary(nodeBinaryPath: string | undefined): string {
  if (nodeBinaryPath === undefined) {
    throw new CommandFailure(
      'WASMCLOUD_NODE_REQUIRED',
      'Node.js is required to run the jco toolchain; install node and make sure it is on PATH',
      3,
      { tool: 'node' },
    );
  }
  return nodeBinaryPath;
}

export function toolFailed(command: string, exitCode: number): CommandFailure {
  return new CommandFailure(
    'WASMCLOUD_TOOL_FAILED',
    `${command} failed with exit code ${exitCode}`,
    3,
    { command, exitCode },
  );
}
