import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import mockCourier from '../../src/services/couriers/mock/index.js';
import { closeApps, makeApp, sampleOrder } from '../helpers/index.js';

afterEach(closeApps);

const setup = async () => request((await makeApp([mockCourier])).app);

describe('operators', () => {
  it('lists operators stored in the database', async () => {
    const api = await setup();
    const res = await api.get('/api/v1/operators');
    expect(res.status).toBe(200);
    const mock = res.body.data.operators.find((o) => o.code === 'mock');
    expect(mock).toMatchObject({ enabled: true, active: true });
  });

  it('disables and re-enables an operator at runtime', async () => {
    const api = await setup();
    const off = await api.patch('/api/v1/operators/mock').send({ enabled: false });
    expect(off.body.data.active).toBe(false);

    const blocked = await api.post('/api/v1/orders').send(sampleOrder('OP-1'));
    expect(blocked.body.error.code).toBe('UNKNOWN_COURIER');

    await api.patch('/api/v1/operators/mock').send({ enabled: true });
    const created = await api.post('/api/v1/orders').send(sampleOrder('OP-1'));
    expect(created.status).toBe(201);
  });

  it('merges settings and rejects operators without an installed adapter', async () => {
    const api = await setup();
    const res = await api.patch('/api/v1/operators/mock').send({ settings: { latencyMs: 1 } });
    expect(res.body.data.settings).toMatchObject({ latencyMs: 1, stepSeconds: 0.001 });

    const unknown = await api.patch('/api/v1/operators/delhivery').send({ enabled: true });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('UNKNOWN_COURIER');
    expect((await api.get('/api/v1/operators/nope')).status).toBe(404);
  });

  it('requires the api key when one is configured', async () => {
    const { app } = await makeApp([mockCourier], { env: { API_KEY: 'secret' } });
    const api = request(app);
    expect((await api.get('/api/v1/couriers')).status).toBe(401);
    expect((await api.get('/api/v1/couriers').set('x-api-key', 'secret')).status).toBe(200);
    expect((await api.get('/health')).status).toBe(200);
  });
});
