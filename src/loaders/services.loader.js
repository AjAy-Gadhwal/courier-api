import { BulkService } from '../services/bulk.service.js';
import { OperatorService } from '../services/operator.service.js';
import { OrderService } from '../services/order.service.js';

export function loadServices({ registry, repositories, events, config, courierSeed }) {
  const order = new OrderService({
    registry,
    orderRepository: repositories.order,
    trackingEventRepository: repositories.trackingEvent,
    events,
  });
  const operator = new OperatorService({
    registry,
    courierOperatorRepository: repositories.courierOperator,
    defaults: courierSeed.defaults,
    env: config.rawEnv,
  });
  return { order, operator };
}

export function loadBulkService({ registry, repositories, jobs, config }) {
  return new BulkService({
    registry,
    bulkBatchRepository: repositories.bulkBatch,
    bulkBatchJob: jobs.bulkBatch,
    maxSize: config.bulkMaxSize,
  });
}
