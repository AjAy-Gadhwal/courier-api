import { BulkBatchRepository } from '../repositories/bulkBatch.repository.js';
import { CourierOperatorRepository } from '../repositories/courierOperator.repository.js';
import { OrderRepository } from '../repositories/order.repository.js';
import { TrackingEventRepository } from '../repositories/trackingEvent.repository.js';

export function loadRepositories(models) {
  return {
    order: new OrderRepository(models),
    trackingEvent: new TrackingEventRepository(models),
    bulkBatch: new BulkBatchRepository(models),
    courierOperator: new CourierOperatorRepository(models),
  };
}
