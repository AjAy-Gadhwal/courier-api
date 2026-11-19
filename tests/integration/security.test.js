import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import mockCourier from '../../src/services/couriers/mock/index.js';
import { closeApps, makeApp, sampleOrder } from '../helpers/index.js';

afterEach(closeApps);

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const { app } = await makeApp([mockCourier]);
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});

describe('rate limiting', () => {
  const limited = { RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_MAX: '3', RATE_LIMIT_STRICT_MAX: '2', RATE_LIMIT_WINDOW_MS: '60000' };

  it('returns 429 in the normalized error shape once the limit is hit', async () => {
    const { app } = await makeApp([mockCourier], { env: limited });
    const api = request(app);

    for (let i = 0; i < 3; i++) expect((await api.get('/api/v1/couriers')).status).toBe(200);

    const blocked = await api.get('/api/v1/couriers');
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.details.retry_after_seconds).toBeGreaterThan(0);
    expect(blocked.headers['ratelimit']).toBeDefined();
  });

  it('keeps /health outside the limiter', async () => {
    const { app } = await makeApp([mockCourier], { env: limited });
    const api = request(app);
    for (let i = 0; i < 6; i++) expect((await api.get('/health')).status).toBe(200);
  });

  it('applies a stricter limit to bulk submissions', async () => {
    const { app } = await makeApp([mockCourier], { env: { ...limited, RATE_LIMIT_MAX: '100' } });
    const api = request(app);
    const body = { orders: [sampleOrder('RL-1')] };

    expect((await api.post('/api/v1/orders/bulk').send(body)).status).toBe(202);
    expect((await api.post('/api/v1/orders/bulk').send(body)).status).toBe(202);
    const third = await api.post('/api/v1/orders/bulk').send(body);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });

  it('counts clients separately by api key', async () => {
    const { app } = await makeApp([mockCourier], { env: { ...limited, API_KEY: 'k1' } });
    const api = request(app);
    for (let i = 0; i < 3; i++) await api.get('/api/v1/couriers').set('x-api-key', 'k1');
    expect((await api.get('/api/v1/couriers').set('x-api-key', 'k1')).status).toBe(429);
  });

  it('can be switched off', async () => {
    const { app } = await makeApp([mockCourier], { env: { RATE_LIMIT_ENABLED: 'false', RATE_LIMIT_MAX: '1' } });
    const api = request(app);
    for (let i = 0; i < 5; i++) expect((await api.get('/api/v1/couriers')).status).toBe(200);
  });
});
