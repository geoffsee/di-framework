export type ExitCode = 0 | 1 | 2 | 3;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export type CliStream = { write(chunk: string): unknown };

export type CliIo = {
  stdout: CliStream;
  stderr: CliStream;
};

export type CommandResult = {
  data?: JsonValue;
  text?: string;
  exitCode?: ExitCode;
};

export type CommandContext = {
  args: string[];
  command: string[];
  io: CliIo;
};

export type CommandNode = {
  description: string;
  usage?: string;
  options?: readonly string[];
  children?: Record<string, CommandNode>;
  run?: (context: CommandContext) => CommandResult | undefined | Promise<CommandResult | undefined>;
};

export class CommandFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: Exclude<ExitCode, 0>,
    readonly details?: JsonValue,
  ) {
    super(message);
    this.name = 'CommandFailure';
  }
}

/**
 * Structural CommandFailure guard. An installed extension resolves its own copy of this
 * package, so `instanceof` cannot identify failures thrown across package instances.
 */
export function isCommandFailure(error: unknown): error is CommandFailure {
  if (!(error instanceof Error) || error.name !== 'CommandFailure') return false;
  const candidate = error as Partial<CommandFailure>;
  return (
    typeof candidate.code === 'string' &&
    (candidate.exitCode === 1 || candidate.exitCode === 2 || candidate.exitCode === 3)
  );
}
