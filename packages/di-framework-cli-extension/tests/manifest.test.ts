import { describe, expect, it } from 'bun:test';
import {
  defineExtension,
  EXTENSION_NAME_PATTERN,
  EXTENSION_SCHEMA_VERSION,
  type ExtensionManifest,
  validateExtensionManifest,
} from '../src/index';

function validManifest(): ExtensionManifest {
  return {
    schemaVersion: EXTENSION_SCHEMA_VERSION,
    name: 'wasmcloud',
    description: 'Build and run apps as wasmCloud components',
    command: {
      description: 'wasmCloud operations',
      children: {
        build: {
          description: 'Build the component',
          usage: 'di-framework wasmcloud build',
          options: ['--verbose  Emit detailed progress'],
          run: () => ({}),
        },
      },
    },
  };
}

function issuePaths(value: unknown): string[] {
  return validateExtensionManifest(value).map((issue) => issue.path);
}

describe('validateExtensionManifest', () => {
  it('accepts a valid group manifest and a valid leaf manifest', () => {
    expect(validateExtensionManifest(validManifest())).toEqual([]);
    expect(
      validateExtensionManifest({
        schemaVersion: 1,
        name: 'single',
        description: 'One-command extension',
        command: { description: 'Run the one command', run: () => undefined },
      }),
    ).toEqual([]);
  });

  it('rejects non-object manifests', () => {
    for (const value of [null, undefined, 'manifest', 7, ['x']]) {
      expect(validateExtensionManifest(value)).toEqual([
        { path: 'manifest', message: 'must be an object' },
      ]);
    }
  });

  it('rejects unsupported schema versions', () => {
    expect(issuePaths({ ...validManifest(), schemaVersion: 2 })).toContain(
      'manifest.schemaVersion',
    );
    expect(issuePaths({ ...validManifest(), schemaVersion: undefined })).toContain(
      'manifest.schemaVersion',
    );
  });

  it('rejects missing or malformed names', () => {
    expect(issuePaths({ ...validManifest(), name: undefined })).toContain('manifest.name');
    for (const name of ['Wasmcloud', '9lives', 'has space', '-lead', '']) {
      expect(EXTENSION_NAME_PATTERN.test(name)).toBe(false);
      expect(issuePaths({ ...validManifest(), name })).toContain('manifest.name');
    }
  });

  it('rejects missing or empty descriptions', () => {
    expect(issuePaths({ ...validManifest(), description: undefined })).toContain(
      'manifest.description',
    );
    expect(issuePaths({ ...validManifest(), description: '' })).toContain('manifest.description');
  });

  it('rejects a non-object command node', () => {
    expect(issuePaths({ ...validManifest(), command: 'build' })).toContain('manifest.command');
  });

  it('rejects command nodes with malformed descriptive fields', () => {
    const command = {
      description: '',
      usage: 7,
      options: 'not-a-list',
      run: () => undefined,
    };
    const paths = issuePaths({ ...validManifest(), command });
    expect(paths).toContain('manifest.command.description');
    expect(paths).toContain('manifest.command.usage');
    expect(paths).toContain('manifest.command.options');
    expect(
      issuePaths({
        ...validManifest(),
        command: { description: 'ok', options: ['fine', 7], run: () => undefined },
      }),
    ).toContain('manifest.command.options');
  });

  it('rejects nodes that are not exactly a group or a leaf', () => {
    expect(
      issuePaths({ ...validManifest(), command: { description: 'neither group nor leaf' } }),
    ).toContain('manifest.command');
    expect(
      issuePaths({
        ...validManifest(),
        command: { description: 'both', children: {}, run: () => undefined },
      }),
    ).toContain('manifest.command');
  });

  it('rejects a run property that is not a function', () => {
    expect(
      issuePaths({ ...validManifest(), command: { description: 'bad leaf', run: 'go' } }),
    ).toContain('manifest.command.run');
  });

  it('rejects malformed children collections', () => {
    expect(
      issuePaths({ ...validManifest(), command: { description: 'bad group', children: ['x'] } }),
    ).toContain('manifest.command.children');
    expect(
      issuePaths({ ...validManifest(), command: { description: 'empty group', children: {} } }),
    ).toContain('manifest.command.children');
  });

  it('validates child names and recurses into child nodes', () => {
    const command = {
      description: 'group',
      children: {
        Bad_Name: { description: 'child', run: () => undefined },
        nested: {
          description: 'nested group',
          children: { leaf: { description: '', run: () => undefined } },
        },
      },
    };
    const paths = issuePaths({ ...validManifest(), command });
    expect(paths).toContain('manifest.command.children.Bad_Name');
    expect(paths).toContain('manifest.command.children.nested.children.leaf.description');
  });
});

describe('defineExtension', () => {
  it('returns the frozen manifest when valid', () => {
    const manifest = validManifest();
    const defined = defineExtension(manifest);
    expect(defined).toBe(manifest);
    expect(Object.isFrozen(defined)).toBe(true);
  });

  it('throws a TypeError naming every issue when invalid', () => {
    expect(() =>
      defineExtension({ ...validManifest(), name: 'Bad Name', description: '' }),
    ).toThrow(
      new TypeError(
        'Invalid extension manifest: manifest.name: must match /^[a-z][a-z0-9-]*$/; manifest.description: must be a non-empty string',
      ),
    );
  });
});
