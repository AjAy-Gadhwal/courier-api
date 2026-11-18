import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import urbaneBolt from '../../src/services/couriers/urbanebolt/index.js';
import { closeApps, fakeServer, json, makeApp, sampleOrder } from '../helpers/index.js';

let servers = [];

afterEach(async () => {
  await closeApps();
  await Promise.all(servers.map((server) => server.close()));
  servers = [];
});

const startFake = async (handler) => {
  const server = await fakeServer(handler);
  servers.push(server);
  return server;
};

const credentials = { URBANEBOLT_USERNAME: 'u', URBANEBOLT_PASSWORD: 'p' };
const withUrbaneBolt = (url, extra = {}) => ({
  env: credentials,
  couriers: { urbanebolt: { settings: { baseUrl: url, customerCode: 'CUST1' }, ...extra } },
});

describe('UrbaneBolt adapter against a fake UrbaneBolt server', () => {
  it('authenticates, creates, tracks and cancels through the unified API', async () => {
    let tokens = 0;
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth/getToken')) return json(res, 200, { access_token: `tok${++tokens}`, expires_in: 3600 });
      if (req.url.startsWith('/api/v1/services/manifest')) return json(res, 200, { success: true, data: { awb: 'UB123', id: 77 } });
      if (req.url.startsWith('/api/v1/services/tracking-pub')) {
        return json(res, 200, {
          data: {
            scans: [
              { status: 'Manifested', timestamp: '2026-11-01T10:00:00Z', location: 'BLR' },
              { status: 'Picked Up', timestamp: '2026-11-01T12:00:00Z', location: 'BLR' },
              { status: 'In Transit', timestamp: '2026-11-02T08:00:00Z', location: 'PNQ' },
            ],
          },
        });
      }
      if (req.url.startsWith('/api/v1/services/cancel')) return json(res, 200, { success: true });
      json(res, 404, {});
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url));
    const api = request(app);

    const created = await api.post('/api/v1/orders').send(sampleOrder('UB-1', 'urbanebolt'));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ awb_number: 'UB123', courier_order_id: '77', status: 'CREATED' });

    const manifest = fake.calls.find((call) => call.url.includes('manifest'));
    expect(manifest.headers.authorization).toBe('Bearer tok1');
    expect(manifest.body.customer_code).toBe('CUST1');
    expect(manifest.body.order_number).toBe('UB-1');

    const tracked = await api.get('/api/v1/orders/UB-1/track');
    expect(tracked.body.data.status).toBe('IN_TRANSIT');
    expect(tracked.body.data.events.map((e) => e.status)).toEqual(expect.arrayContaining(['CREATED', 'PICKED_UP', 'IN_TRANSIT']));
    expect(tracked.body.data.events).toHaveLength(4);

    const cancelled = await api.post('/api/v1/orders/UB-1/cancel').send({});
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(tokens).toBe(1);
  });

  it('re-authenticates once on 401 and retries', async () => {
    let tokens = 0;
    let manifestCalls = 0;
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, 200, { token: `t${++tokens}` });
      manifestCalls++;
      if (req.headers.authorization === 'Bearer t1') return json(res, 401, { detail: 'token expired' });
      json(res, 200, { awb: 'UB9' });
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url));

    const res = await request(app).post('/api/v1/orders').send(sampleOrder('UB-AUTH', 'urbanebolt'));
    expect(res.status).toBe(201);
    expect(tokens).toBe(2);
    expect(manifestCalls).toBe(2);
  });

  it('retries 5xx, then fails gracefully and flags the order for reconciliation', async () => {
    let manifestCalls = 0;
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, 200, { token: 't' });
      manifestCalls++;
      json(res, 503, { message: 'upstream exploded: secret-internal-detail' });
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url));
    const api = request(app);

    const res = await api.post('/api/v1/orders').send(sampleOrder('UB-5XX', 'urbanebolt'));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('COURIER_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('secret-internal-detail');
    expect(manifestCalls).toBe(3);

    const stored = await api.get('/api/v1/orders/UB-5XX');
    expect(stored.body.data).toMatchObject({ status: 'FAILED', needs_reconciliation: true });
  });

  it('maps courier 4xx to normalized codes without retrying', async () => {
    let calls = 0;
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, 200, { token: 't' });
      calls++;
      json(res, 400, { message: 'Delivery pincode 411001 not serviceable' });
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url));

    const res = await request(app).post('/api/v1/orders').send(sampleOrder('UB-4XX', 'urbanebolt'));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('COURIER_UNSERVICEABLE');
    expect(calls).toBe(1);
  });

  it('reports COURIER_TIMEOUT for slow couriers', async () => {
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, 200, { token: 't' });
      setTimeout(() => json(res, 200, { awb: 'LATE' }), 2000).unref();
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url, { runtime: { timeoutMs: 100, maxRetries: 1 } }));

    const res = await request(app).post('/api/v1/orders').send(sampleOrder('UB-TO', 'urbanebolt'));
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('COURIER_TIMEOUT');
  });

  it('is skipped without credentials and fails fast when half configured', async () => {
    const couriers = { urbanebolt: { settings: { baseUrl: 'http://x', customerCode: 'C' } } };
    expect((await makeApp([urbaneBolt], { couriers })).registry.supported()).toEqual([]);
    await expect(makeApp([urbaneBolt], { env: { URBANEBOLT_USERNAME: 'u' }, couriers })).rejects.toThrow(/misconfigured/);
  });

  it('keeps the working adapter when the operators API receives invalid settings', async () => {
    const fake = await startFake((req, _body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, 200, { token: 't' });
      json(res, 200, { awb: 'UBOK' });
    });
    const { app } = await makeApp([urbaneBolt], withUrbaneBolt(fake.url));
    const api = request(app);

    const bad = await api.patch('/api/v1/operators/urbanebolt').send({ settings: { baseUrl: 'not-a-url' } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const stored = await api.get('/api/v1/operators/urbanebolt');
    expect(stored.body.data.settings.baseUrl).toBe(fake.url);
    expect((await api.post('/api/v1/orders').send(sampleOrder('UB-OK', 'urbanebolt'))).status).toBe(201);
  });

  it('reads secrets from the env variable names stored in credentials_env', async () => {
    const fake = await startFake((req, body, res) => {
      if (req.url.startsWith('/api/v1/auth')) return json(res, body.username === 'custom-u' ? 200 : 401, { token: 't' });
      json(res, 200, { awb: 'UBX' });
    });
    const { app } = await makeApp([urbaneBolt], {
      env: { MY_UB_USER: 'custom-u', MY_UB_PASS: 'p' },
      couriers: {
        urbanebolt: {
          settings: { baseUrl: fake.url, customerCode: 'C' },
          credentialsEnv: { username: 'MY_UB_USER', password: 'MY_UB_PASS' },
        },
      },
    });

    const res = await request(app).post('/api/v1/orders').send(sampleOrder('UB-ENV', 'urbanebolt'));
    expect(res.status).toBe(201);
  });
});
