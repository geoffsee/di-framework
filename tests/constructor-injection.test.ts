import { describe, it, expect, beforeEach } from 'bun:test';
import { getContainer } from '../container';
import { Container as Injectable, Component } from '../decorators';

beforeEach(() => {
  getContainer().clear();
});

describe('Constructor parameter injection with @Component', () => {
  it('injects class dependencies into constructor using @Component on params', () => {
    @Injectable()
    class Repo { id = 'repo'; }

    @Injectable()
    class Service {
      dep: Repo;
      constructor(@Component(Repo) dep: Repo) {
        this.dep = dep;
      }
    }

    const c = getContainer();
    const s = c.resolve(Service);
    expect(s.dep).toBeInstanceOf(Repo);
    // default singleton
    expect(s.dep).toBe(c.resolve(Repo));
  });

  it('supports string tokens in constructor params with factory registration', () => {
    const TOKEN = 'endpoint';

    @Injectable()
    class ApiClient {
      endpoint: string;
      constructor(@Component(TOKEN) endpoint: string) {
        this.endpoint = endpoint;
      }
    }

    const c = getContainer();
    c.registerFactory(TOKEN, () => 'https://example.test');

    const api = c.resolve(ApiClient);
    expect(api.endpoint).toBe('https://example.test');
  });
});
