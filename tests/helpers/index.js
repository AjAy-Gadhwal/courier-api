import http from 'node:http';
import { createApp } from '../../src/app.js';
import { parseCourierSeed } from '../../src/config/courierSeed.js';
import { loadConfig } from '../../src/config/index.js';
import { bootstrap } from '../../src/loaders/index.js';

const baseEnv = { NODE_ENV: 'test', DB_DIALECT: 'sqlite', DB_SQLITE_PATH: ':memory:' };
const openContainers = [];

export async function makeApp(modules, { env = {}, couriers = {} } = {}) {
  const config = loadConfig({ ...baseEnv, ...env });
  const courierSeed = parseCourierSeed({
    defaults: { timeoutMs: 500, maxRetries: 2, retryBaseMs: 1, retryMaxMs: 5 },
    couriers: {
      mock: { settings: { latencyMs: 0, stepSeconds: 0.001 }, ...couriers.mock },
      ...(couriers.urbanebolt ? { urbanebolt: couriers.urbanebolt } : {}),
    },
  });

  const container = await bootstrap({ config, courierSeed, courierModules: modules });
  openContainers.push(container);

  return {
    app: createApp({ config, controllers: container.controllers }),
    container,
    registry: container.registry,
  };
}

export async function closeApps() {
  await Promise.all(openContainers.splice(0).map((container) => container.close()));
}

export const sampleOrder = (orderId, courierPartner = 'mock', extra = {}) => ({
  courier_partner: courierPartner,
  order_id: orderId,
  pickup_address: { name: 'Warehouse', phone: '9876543210', line1: '1 Industrial Rd', city: 'Bengaluru', state: 'KA', pincode: '560001' },
  delivery_address: { name: 'Asha', phone: '9123456780', line1: '22 MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
  items: [{ sku: 'SKU-1', name: 'Shoes', quantity: 1, unit_price: 1999 }],
  shipment: { weight_kg: 1.2, length_cm: 20, breadth_cm: 15, height_cm: 10 },
  payment: { mode: 'PREPAID' },
  ...extra,
});

export async function fakeServer(handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      calls.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, body, res);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

export async function waitForBatch(api, batchId) {
  for (let i = 0; i < 100; i++) {
    const res = await api.get(`/api/v1/orders/bulk/${batchId}`);
    if (res.body.data.status === 'COMPLETED') return res.body.data;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('batch did not complete');
}
