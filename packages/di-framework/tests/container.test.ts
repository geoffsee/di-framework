import { describe, it, expect, beforeEach } from 'bun:test';
import { Container, getContainer, container as globalContainer } from '../container';

class Foo { value = Math.random(); }
class Bar { constructor(public foo: Foo) {} }

// Helper factory
const makeValueFactory = () => ({ n: Math.random() });

describe('Container - registration and resolution', () => {
  let c: Container;

  beforeEach(() => {
    c = new Container();
  });

  it('registers and resolves by class (singleton default)', () => {
    c.register(Foo); 
    const a = c.resolve(Foo);
    const b = c.resolve(Foo);
    expect(a).toBe(b);
  });

  it('registers with singleton=false to get new instances', () => {
    c.register(Foo, { singleton: false });
    const a = c.resolve(Foo);
    const b = c.resolve(Foo);
    expect(a).not.toBe(b);
  });

  it('registerFactory and resolve by string key', () => {
    c.registerFactory('numberFactory', makeValueFactory);
    const v1 = c.resolve<{ n: number }>('numberFactory');
    const v2 = c.resolve<{ n: number }>('numberFactory');
    // default singleton true for factories
    expect(v1).toBe(v2);
    expect(typeof v1.n).toBe('number');
  });

  it('registerFactory with singleton=false yields fresh values', () => {
    c.registerFactory('valueFactory', makeValueFactory, { singleton: false });
    const v1 = c.resolve<{ n: number }>('valueFactory');
    const v2 = c.resolve<{ n: number }>('valueFactory');
    expect(v1).not.toBe(v2);
  });

  it('has() reflects class registration, getServiceNames() lists string registrations', () => {
    c.register(Foo);
    c.registerFactory('myFactory', () => 42);
    expect(c.has(Foo)).toBe(true);
    expect(c.has('myFactory')).toBe(true);
    const names = c.getServiceNames();
    expect(names).toContain('Foo');
    expect(names).toContain('myFactory');
  });

  it('clear() removes all registrations', () => {
    c.register(Foo);
    c.registerFactory('x', () => 1);
    c.clear();
    expect(c.has(Foo)).toBe(false);
    expect(c.getServiceNames().length).toBe(0);
  });

  it('throws a helpful error when resolving an unregistered service', () => {
    expect(() => c.resolve('NotThere')).toThrow("Service 'NotThere' is not registered in the DI container");
  });
});

describe('Container - property injection circular detection (via nested resolve calls)', () => {
  it('detects circular dependency on resolution stack for class registrations', () => {
    // We simulate circular via factories that resolve each other
    const c = new Container();
    c.registerFactory('A', () => c.resolve('B'));
    c.registerFactory('B', () => c.resolve('A'));

    expect(() => c.resolve('A')).toThrow(/Circular dependency detected/);
  });
});

describe('Global container export utilities', () => {
  it('getContainer() returns the singleton container instance', () => {
    expect(getContainer()).toBe(globalContainer);
  });
});
