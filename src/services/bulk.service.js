import { randomUUID } from 'node:crypto';
import { AppError, ValidationError, toAppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createOrderSchema } from '../validations/order.validation.js';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

export class BulkService {
  constructor({ registry, bulkBatchRepository, bulkBatchJob, maxSize }) {
    this.registry = registry;
    this.batches = bulkBatchRepository;
    this.job = bulkBatchJob;
    this.maxSize = maxSize;
  }

  async submit(body, requestId) {
    const list = Array.isArray(body) ? body : isObject(body) ? body.orders : undefined;
    if (!Array.isArray(list)) {
      throw new ValidationError([{ field: 'orders', message: 'orders must be an array of order objects' }]);
    }
    if (list.length === 0) {
      throw new ValidationError([{ field: 'orders', message: 'orders must contain at least 1 order' }]);
    }
    if (list.length > this.maxSize) {
      throw new AppError('BATCH_TOO_LARGE', `A batch may contain at most ${this.maxSize} orders`, {
        max: this.maxSize,
        received: list.length,
      });
    }

    const seen = new Set();
    const items = list.map((raw, idx) => this.prepareItem(raw, idx, seen));

    const batchId = randomUUID();
    await this.batches.create(batchId, requestId, items);

    const accepted = items.filter((item) => item.status === 'PENDING').length;
    if (accepted > 0) this.job.schedule(batchId, requestId ?? batchId);
    else await this.batches.finalizeIfDone(batchId);

    logger.info({ batch_id: batchId, total: items.length, accepted, rejected: items.length - accepted }, 'bulk batch accepted');
    return { batchId, total: items.length, accepted, rejected: items.length - accepted };
  }

  async getBatch(batchId) {
    const batch = await this.batches.get(batchId);
    if (!batch) throw new AppError('BATCH_NOT_FOUND', `Batch '${batchId}' not found`);
    return batch;
  }

  prepareItem(raw, idx, seen) {
    const orderId = isObject(raw) && typeof raw.order_id === 'string' ? raw.order_id : null;
    const courier = isObject(raw) && typeof raw.courier_partner === 'string' ? raw.courier_partner.toLowerCase() : null;
    const rejected = (code, message, details) => ({
      idx,
      orderId,
      courierPartner: courier,
      status: 'FAILED',
      error: { code, message, details },
    });

    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, code: i.code }));
      return rejected('VALIDATION_ERROR', 'Order failed validation', details);
    }

    try {
      this.registry.resolve(parsed.data.courier_partner);
    } catch (error) {
      const appError = toAppError(error);
      return rejected(appError.code, appError.message, appError.details);
    }

    if (seen.has(parsed.data.order_id)) {
      return rejected('ORDER_ID_CONFLICT', 'Duplicate order_id within this batch (first occurrence wins)');
    }
    seen.add(parsed.data.order_id);

    return {
      idx,
      orderId: parsed.data.order_id,
      courierPartner: parsed.data.courier_partner,
      status: 'PENDING',
      payload: parsed.data,
    };
  }
}
