import { expect, test, describe, beforeAll } from 'bun:test';
import { useContainer } from '@di-framework/di-framework/container';
import { handleRequest } from './router';
// Ensure decorator side-effects for services are applied in same module graph
import '../../services/LoggerService';
import '../../services/DatabaseService';
import '../../services/UserService';

describe('cf-worker router', () => {
  beforeAll(() => {
    const container = useContainer();
    if (!container.has('APP_NAME')) {
      container.registerFactory('APP_NAME', () => 'Test Worker', {
        singleton: true,
      });
    }
  });

  const mockEnv = {};
  const mockCtx = {};

  test('GET / returns HTML index', async () => {
    const req = new Request('http://localhost/');
    const res = await handleRequest(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const text = await res.text();
    expect(text).toContain('DI Worker Example');
  });

  test('GET /api/info returns info and services', async () => {
    const req = new Request('http://localhost/api/info');
    const res = await handleRequest(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.services).toBeDefined();
    expect(Array.isArray(body.services)).toBe(true);
  });

  test('GET /api/not-found returns 404', async () => {
    const req = new Request('http://localhost/api/not-found');
    const res = await handleRequest(req, mockEnv, mockCtx);
    expect(res.status).toBe(404);
  });
});
