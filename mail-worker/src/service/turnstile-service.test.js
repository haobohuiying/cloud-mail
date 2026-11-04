import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('./setting-service', () => ({default: {query: vi.fn(async () => ({secretKey: 'test-secret'}))}}));
vi.mock('../i18n/i18n', () => ({t: key => key}));
import turnstileService from './turnstile-service';

const context = {req: {url: 'https://mail.example.com/api/login', header: () => '192.0.2.1'}};
afterEach(() => vi.unstubAllGlobals());

describe('login Turnstile validation', () => {
  it('rejects missing tokens without calling Cloudflare', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(turnstileService.verify(context, '', 'login')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {success: false},
    {success: true, action: 'register', hostname: 'mail.example.com'},
    {success: true, action: 'login', hostname: 'other.example.com'},
  ])('rejects failed validation or a different action/hostname: %j', async result => {
    vi.stubGlobal('fetch', vi.fn(async () => ({json: async () => result})));
    await expect(turnstileService.verify(context, 'token', 'login')).rejects.toThrow();
  });

  it('accepts a valid login token and sends the secret only to Siteverify', async () => {
    const fetchMock = vi.fn(async () => ({json: async () => ({success: true, action: 'login', hostname: 'mail.example.com'})}));
    vi.stubGlobal('fetch', fetchMock);
    await turnstileService.verify(context, 'token', 'login');
    expect(fetchMock.mock.calls[0][0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(fetchMock.mock.calls[0][1].body.get('secret')).toBe('test-secret');
  });
});
