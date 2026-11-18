import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import mockCourier from '../../src/services/couriers/mock/index.js';
import { closeApps, makeApp, sampleOrder } from '../helpers/index.js';

afterEach(closeApps);

const setup = async () => {
  const { app } = await makeApp([mockCourier]);
  return request(app);
};

describe('orders', () => {
  it('creates an order through the mock courier and replays idempotently', async () => {
    const api = await setup();
    const first = await api.post('/api/v1/orders').send(sampleOrder('ORD-1'));
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ order_id: 'ORD-1', courier_partner: 'mock', status: 'CREATED', idempotent_replay: false });
    expect(first.body.data.awb_number).toMatch(/^MCK-/);

    const second = await api.post('/api/v1/orders').send(sampleOrder('ORD-1'));
    expect(second.status).toBe(200);
    expect(second.body.data.idempotent_replay).toBe(true);
    expect(second.body.data.awb_number).toBe(first.body.data.awb_number);
  });

  it('returns a normalized 400 with field level errors', async () => {
    const api = await setup();
    const order = sampleOrder('ORD-2', 'mock', { payment: { mode: 'COD' } });
    order.delivery_address.pincode = '12';

    const res = await api.post('/api/v1/orders').send(order);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toContain('delivery_address.pincode');
    expect(fields).toContain('payment.cod_amount');
    expect(res.body.error.request_id).toBeTruthy();
  });

  it('returns 400 with the supported couriers for an unknown courier_partner', async () => {
    const api = await setup();
    const res = await api.post('/api/v1/orders').send(sampleOrder('ORD-3', 'delhivery'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_COURIER');
    expect(res.body.error.details.supported_couriers).toEqual(['mock']);
  });

  it('maps courier failures, hides raw errors and keeps failed orders for reconciliation', async () => {
    const api = await setup();
    const rejected = await api.post('/api/v1/orders').send(sampleOrder('ORD-FAIL-1'));
    expect(rejected.status).toBe(422);
    expect(rejected.body.error.code).toBe('COURIER_VALIDATION_ERROR');
    expect(JSON.stringify(rejected.body)).not.toContain('mock: invalid consignee');

    const stored = await api.get('/api/v1/orders/ORD-FAIL-1');
    expect(stored.body.data.status).toBe('FAILED');
    expect(stored.body.data.failure.code).toBe('COURIER_VALIDATION_ERROR');

    const down = await api.post('/api/v1/orders').send(sampleOrder('ORD-DOWN-1'));
    expect(down.status).toBe(502);
    const worklist = await api.get('/api/v1/orders?needs_reconciliation=true');
    expect(worklist.body.data.orders.map((o) => o.order_id)).toContain('ORD-DOWN-1');
  });

  it('tracks without duplicating history and refuses to cancel delivered orders', async () => {
    const api = await setup();
    await api.post('/api/v1/orders').send(sampleOrder('ORD-T1'));
    await new Promise((resolve) => setTimeout(resolve, 30));

    const first = await api.get('/api/v1/orders/ORD-T1/track');
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('DELIVERED');
    const total = first.body.data.events.length;
    expect(total).toBeGreaterThan(1);

    const second = await api.get('/api/v1/orders/ORD-T1/track');
    expect(second.body.data.events.length).toBe(total);

    const cancel = await api.post('/api/v1/orders/ORD-T1/cancel').send({ courier_partner: 'mock' });
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.code).toBe('INVALID_ORDER_STATE');
  });

  it('cancels an in-flight shipment idempotently', async () => {
    const { app } = await makeApp([mockCourier], { couriers: { mock: { settings: { latencyMs: 0, stepSeconds: 3600 } } } });
    const api = request(app);
    await api.post('/api/v1/orders').send(sampleOrder('ORD-C1'));

    const first = await api.post('/api/v1/orders/ORD-C1/cancel').send({ reason: 'customer request' });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('CANCELLED');

    const again = await api.post('/api/v1/orders/ORD-C1/cancel').send({});
    expect(again.body.data.idempotent_replay).toBe(true);

    const missing = await api.post('/api/v1/orders/NOPE/cancel').send({});
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('uses the same error shape for bad JSON and unknown routes', async () => {
    const api = await setup();
    const badJson = await api.post('/api/v1/orders').set('Content-Type', 'application/json').send('{bad');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');

    const unknown = await api.get('/api/v1/nothing');
    expect(unknown.status).toBe(404);
    expect(unknown.body.success).toBe(false);
  });
});
