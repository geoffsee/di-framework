import { describe, expect, it } from 'bun:test';
import { CommandFailure, isCommandFailure } from '../src/index';

describe('CommandFailure', () => {
  it('carries code, exit code, and optional details', () => {
    const bare = new CommandFailure('SOME_CODE', 'went wrong', 2);
    expect(bare.name).toBe('CommandFailure');
    expect(bare.code).toBe('SOME_CODE');
    expect(bare.message).toBe('went wrong');
    expect(bare.exitCode).toBe(2);
    expect(bare.details).toBeUndefined();

    const detailed = new CommandFailure('OTHER_CODE', 'details attached', 3, { token: 'x' });
    expect(detailed.details).toEqual({ token: 'x' });
    expect(detailed).toBeInstanceOf(Error);
  });
});

describe('isCommandFailure', () => {
  it('accepts CommandFailure instances for every failure exit code', () => {
    for (const exitCode of [1, 2, 3] as const) {
      expect(isCommandFailure(new CommandFailure('CODE', 'message', exitCode))).toBe(true);
    }
  });

  it('accepts structurally equivalent failures from another module instance', () => {
    const foreign = Object.assign(new Error('cross-package failure'), {
      code: 'FOREIGN_CODE',
      exitCode: 3,
    });
    foreign.name = 'CommandFailure';
    expect(isCommandFailure(foreign)).toBe(true);
  });

  it('rejects values that are not Error instances', () => {
    expect(isCommandFailure(undefined)).toBe(false);
    expect(isCommandFailure('CommandFailure')).toBe(false);
    expect(isCommandFailure({ name: 'CommandFailure', code: 'X', exitCode: 2 })).toBe(false);
  });

  it('rejects errors without the CommandFailure name', () => {
    const error = Object.assign(new Error('plain'), { code: 'X', exitCode: 2 });
    expect(isCommandFailure(error)).toBe(false);
  });

  it('rejects errors without a string code or a failure exit code', () => {
    const noCode = new Error('no code');
    noCode.name = 'CommandFailure';
    Object.assign(noCode, { exitCode: 2 });
    expect(isCommandFailure(noCode)).toBe(false);

    for (const exitCode of [0, 4, '2', undefined]) {
      const wrongExit = new Error('wrong exit');
      wrongExit.name = 'CommandFailure';
      Object.assign(wrongExit, { code: 'X', exitCode });
      expect(isCommandFailure(wrongExit)).toBe(false);
    }
  });
});
