import { describe, it, expect, beforeEach } from 'bun:test';
import { useContainer, Container as DIContainer } from '../container';
import { Container as Injectable, Component, isInjectable, getInjectionContainer } from '../decorators';

// Reset the global container before each test to avoid cross-test pollution
beforeEach(() => {
  useContainer().clear();
});

describe('Decorators - @Container and @Component integration', () => {
  it('marks a class as injectable and registers it with the global container', () => {
    @Injectable()
    class ServiceA { value = 1; }

    const c = getInjectionContainer();

    expect(isInjectable(ServiceA)).toBe(true);
    expect(c.has(ServiceA)).toBe(true);

    const a = c.resolve(ServiceA);
    expect(a).toBeInstanceOf(ServiceA);
  });

  it('injects dependencies via property @Component(ClassRef)', () => {
    @Injectable()
    class Dep { id = Symbol('dep'); }

    @Injectable()
    class Consumer {
      @Component(Dep)
      dep!: Dep;
    }

    const c = useContainer();
    const consumer = c.resolve(Consumer);
    expect(consumer.dep).toBeInstanceOf(Dep);

    // Default singleton behavior should share the same instance
    const depFromContainer = c.resolve(Dep);
    expect(consumer.dep).toBe(depFromContainer);
  });

  it('injects string token via property decorator with factory registration', () => {
    const TOKEN = 'apiKey';

    @Injectable()
    class UsesToken {
      @Component(TOKEN)
      apiKey!: string;
    }

    const c = useContainer();
    c.registerFactory(TOKEN, () => 'secret-123');

    const u = c.resolve(UsesToken);
    expect(u.apiKey).toBe('secret-123');
  });

  it('can mix multiple property injections', () => {
    const TOKEN = 'cfg';

    @Injectable()
    class Logger { logs: string[] = []; log(m: string){ this.logs.push(m); } }

    @Injectable()
    class Repo { }

    @Injectable()
    class Service {
      @Component(Logger) logger!: Logger;
      @Component(Repo) repo!: Repo;
      @Component(TOKEN) cfg!: { env: string };
    }

    const c = useContainer();
    c.registerFactory(TOKEN, () => ({ env: 'test' }));

    const s = c.resolve(Service);
    expect(s.logger).toBeInstanceOf(Logger);
    expect(s.repo).toBeInstanceOf(Repo);
    expect(s.cfg.env).toBe('test');
  });
});

describe('Decorators - singleton option and container injection', () => {
  it('respects singleton: false option in @Container decorator', () => {
    @Injectable({ singleton: false })
    class Transient { x = Math.random(); }

    const c = useContainer();
    const a = c.resolve(Transient);
    const b = c.resolve(Transient);
    expect(a).not.toBe(b);
  });

  it('allows custom container option if provided (using a fresh container)', () => {
    const custom = new DIContainer();

    @Injectable({ container: custom })
    class LocalService {}

    expect(custom.has(LocalService)).toBe(true);
    // Not registered in the global container since a custom one was used
    expect(useContainer().has(LocalService)).toBe(false);
  });
});
