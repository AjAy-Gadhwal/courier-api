import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import mockCourier from '../../src/services/couriers/mock/index.js';
import { closeApps, makeApp, sampleOrder, waitForBatch } from '../helpers/index.js';

afterEach(closeApps);

const setup = async () => request((await makeApp([mockCourier])).app);

describe('bulk orders', () => {
  it('reports partial success, bad items, in-batch duplicates and stays idempotent across batches', async () => {
    const api = await setup();
    const orders = [
      sampleOrder('B-1'),
      sampleOrder('B-FAIL-2'),
      sampleOrder('B-3', 'nope'),
      { ...sampleOrder('B-4'), items: [] },
      sampleOrder('B-1'),
      sampleOrder('B-6'),
    ];

    const res = await api.post('/api/v1/orders/bulk').send({ orders });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ total: 6, accepted: 3, rejected: 3 });

    const batch = await waitForBatch(api, res.body.data.batch_id);
    expect(batch).toMatchObject({ status: 'COMPLETED', total: 6, succeeded: 2, failed: 4, pending: 0 });

    const result = (index) => batch.results.find((r) => r.index === index);
    expect(result(0).status).toBe('SUCCEEDED');
    expect(result(0).awb_number).toMatch(/^MCK-/);
    expect(result(1).error.code).toBe('COURIER_VALIDATION_ERROR');
    expect(result(2).error.code).toBe('UNKNOWN_COURIER');
    expect(result(3).error.code).toBe('VALIDATION_ERROR');
    expect(result(4).error.code).toBe('ORDER_ID_CONFLICT');
    expect(result(5).status).toBe('SUCCEEDED');

    const again = await api.post('/api/v1/orders/bulk').send({ orders: [sampleOrder('B-1')] });
    const second = await waitForBatch(api, again.body.data.batch_id);
    expect(second.results[0].status).toBe('SUCCEEDED');
    expect(second.results[0].awb_number).toBe(result(0).awb_number);
  });

  it('accepts 100 orders without blocking and rejects 101', async () => {
    const api = await setup();
    const orders = Array.from({ length: 100 }, (_, i) => sampleOrder(`BULK-${i}`));

    const startedAt = Date.now();
    const res = await api.post('/api/v1/orders/bulk').send({ orders });
    expect(res.status).toBe(202);
    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect((await waitForBatch(api, res.body.data.batch_id)).succeeded).toBe(100);

    const tooMany = await api.post('/api/v1/orders/bulk').send({ orders: [...orders, sampleOrder('BULK-X')] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('BATCH_TOO_LARGE');
  });

  it('returns 404 for an unknown batch', async () => {
    const api = await setup();
    const res = await api.get('/api/v1/orders/bulk/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BATCH_NOT_FOUND');
  });
});
