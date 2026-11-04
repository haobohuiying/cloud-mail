import app from '../hono/hono';
import loginService from '../service/login-service';
import result from '../model/result';
import userContext from '../security/user-context';

app.post('/login', async (c) => {
	const params = await c.req.json();
	if (c.env.LOGIN_RATE_LIMIT) {
		const keys = [
			`ip:${c.req.header('CF-Connecting-IP') || 'unknown'}`,
			`email:${String(params.email || '').trim().toLowerCase()}`
		];
		for (const key of keys) {
			const { success } = await c.env.LOGIN_RATE_LIMIT.limit({ key });
			if (!success) {
				c.header('Retry-After', '60');
				return c.json(result.fail('登录尝试过于频繁，请在 60 秒后重试 / Too many login attempts. Try again in 60 seconds.', 429), 429);
			}
		}
	}
	const token = await loginService.login(c, params);
	return c.json(result.ok({ token: token }));
});

app.post('/register', async (c) => {
	const jwt = await loginService.register(c, await c.req.json());
	return c.json(result.ok(jwt));
});

app.delete('/logout', async (c) => {
	await loginService.logout(c, userContext.getUserId(c));
	return c.json(result.ok());
});

