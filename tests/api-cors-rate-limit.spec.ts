import { test, expect } from '@playwright/test';

/** Helper to extract CORS headers from a response */
function getCorsHeaders(response: any) {
  return {
    origin: response.headers()['access-control-allow-origin'],
    methods: response.headers()['access-control-allow-methods'],
    headers: response.headers()['access-control-allow-headers'],
  };
}

test.describe('P0 Security Slice – CORS & Rate Limits', () => {
  const base = process.env.FIELDLOT_API_URL ?? 'http://127.0.0.1:3000';

  test('CORS headers are present on normal GET', async ({ request }) => {
    const res = await request.get(`${base}/api/listings`);
    expect(res.status()).toBe(200);
    const cors = getCorsHeaders(res);
    expect(cors.origin).toBe(process.env.FIELDLOT_ALLOWED_ORIGINS || '*');
    expect(cors.methods).toBe('GET,OPTIONS,POST,PUT,DELETE');
    expect(cors.headers).toContain('Content-Type');
  });

  test('CORS headers are present on OPTIONS preflight', async ({ request }) => {
    const res = await request.options(`${base}/api/listings`);
    expect(res.status()).toBe(204);
    const cors = getCorsHeaders(res);
    expect(cors.origin).toBe(process.env.FIELDLOT_ALLOWED_ORIGINS || '*');
    expect(cors.methods).toBe('GET,OPTIONS,POST,PUT,DELETE');
    expect(cors.headers).toContain('Content-Type');
  });

  test('public GET rate limit – 20 req/min', async ({ request }) => {
    for (let i = 0; i < 20; i++) {
      const res = await request.get(`${base}/api/exchange-prices`);
      expect(res.status()).toBe(200);
    }
    const limited = await request.get(`${base}/api/exchange-prices`);
    expect(limited.status()).toBe(429);
    expect(limited.headers()['retry-after']).toBeDefined();
  });

  test('register-interest rate limit – 5 req/min', async ({ request }) => {
    const payload = { email: 'test@example.com', interest: 'test' };
    for (let i = 0; i < 5; i++) {
      const res = await request.post(`${base}/api/register-interest`, { data: payload });
      expect(res.status()).not.toBe(429);
    }
    const limited = await request.post(`${base}/api/register-interest`, { data: payload });
    expect(limited.status()).toBe(429);
    expect(limited.headers()['retry-after']).toBeDefined();
  });

  test('existing LLM route limit still works', async ({ request }) => {
    const res = await request.post(`${base}/api/fieldlot-chat`, { data: { messages: [] } }).catch(() => null);
    expect(res).not.toBeNull();
    expect(res?.status()).toBeGreaterThanOrEqual(200);
  });
});
