import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../service/login-service', () => ({ default: { login: vi.fn(async () => 'test-token') } }));
vi.mock('../security/user-context', () => ({ default: {} }));
import app from '../hono/hono';
import loginService from '../service/login-service';
import './login-api';

describe('login request limits', () => {
  beforeEach(() => vi.clearAllMocks());
  const request = (limit, path = '/login') => app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ email: 'Admin@Example.com', password: 'test' })
  }, { LOGIN_RATE_LIMIT: { limit } });

  it('checks both the trusted client IP and normalized account before login', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const response = await request(limit);
    expect(response.status).toBe(200);
    expect(limit.mock.calls).toEqual([[{ key: 'ip:192.0.2.1' }], [{ key: 'email:admin@example.com' }]]);
    expect(loginService.login).toHaveBeenCalledOnce();
  });

  it.each([0, 1])('rejects when limiter %s is exhausted before checking the password', async (blocked) => {
    let call = 0;
    const response = await request(vi.fn(async () => ({ success: call++ !== blocked })));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect((await response.json()).code).toBe(429);
    expect(loginService.login).not.toHaveBeenCalled();
  });

  it('also blocks the administrator API token password endpoint', async () => {
    const response = await request(vi.fn(async () => ({ success: false })), '/public/genToken');
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
