import { randomBytes } from 'node:crypto';
import { AppError } from '../../../utils/errors.js';
import { sleep } from '../../../utils/sleep.js';

const STAGES = [
  { status: 'CREATED', label: 'Manifested' },
  { status: 'PICKED_UP', label: 'Picked up from seller' },
  { status: 'IN_TRANSIT', label: 'In transit' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

class MockCourierAdapter {
  constructor(latencyMs, stepSeconds) {
    this.code = 'mock';
    this.latencyMs = latencyMs;
    this.stepSeconds = stepSeconds;
    this.cancelled = new Set();
  }

  async createShipment(order) {
    await sleep(this.latencyMs);
    const request = { reference: order.order_id, to: order.delivery_address.pincode, weight: order.shipment.weight_kg };

    if (order.order_id.includes('FAIL')) {
      throw new AppError('COURIER_VALIDATION_ERROR', 'Courier rejected the shipment data', { courier: 'mock' }, {
        courier: 'mock',
        audit: { request, response: { error: 'mock: invalid consignee' } },
      });
    }
    if (order.order_id.includes('DOWN')) {
      throw new AppError('COURIER_UNAVAILABLE', 'Courier service is unavailable', { courier: 'mock' }, {
        courier: 'mock',
        retryable: true,
        audit: { request, response: { error: 'mock: 503' } },
      });
    }

    const awb = `MCK-${Math.floor(Date.now() / 1000)}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const response = { id: `m_${randomBytes(4).toString('hex')}`, awb, label: `https://mock.local/label/${awb}.pdf` };
    return { courierOrderId: response.id, awb, labelUrl: response.label, audit: { request, response } };
  }

  async track({ awb }) {
    await sleep(this.latencyMs);
    const match = /^MCK-(\d+)-/.exec(awb);
    if (!match) {
      throw new AppError('COURIER_SHIPMENT_NOT_FOUND', 'Courier could not find the requested resource', { courier: 'mock' });
    }

    const createdAt = Number(match[1]) * 1000;
    const elapsedSeconds = (Date.now() - createdAt) / 1000;
    const reached = Math.min(STAGES.length - 1, Math.floor(elapsedSeconds / Math.max(this.stepSeconds, 0.001)));

    const events = STAGES.slice(0, reached + 1).map((stage, index) => ({
      status: stage.status,
      courierStatus: stage.label.toUpperCase().replace(/\s+/g, '_'),
      description: stage.label,
      location: 'Mock Hub',
      occurredAt: new Date(createdAt + index * this.stepSeconds * 1000).toISOString(),
      raw: { stage: index, label: stage.label },
    }));

    if (this.cancelled.has(awb)) {
      events.push({
        status: 'CANCELLED',
        courierStatus: 'CANCELLED',
        description: 'Cancelled',
        occurredAt: new Date().toISOString(),
        raw: {},
      });
    }

    return { status: events[events.length - 1].status, events, audit: { request: { awb }, response: { events } } };
  }

  async cancel({ awb }) {
    await sleep(this.latencyMs);
    this.cancelled.add(awb);
    return { cancelled: true, audit: { request: { awb }, response: { cancelled: true } } };
  }
}

export default {
  code: 'mock',
  displayName: 'Mock Courier (demo)',
  enabled: () => true,
  create: (ctx) => new MockCourierAdapter(Number(ctx.settings.latencyMs ?? 50), Number(ctx.settings.stepSeconds ?? 5)),
};
