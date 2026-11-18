import { createBulkController } from './bulk.controller.js';
import { createCourierController } from './courier.controller.js';
import { createHealthController } from './health.controller.js';
import { createOperatorController } from './operator.controller.js';
import { createOrderController } from './order.controller.js';

export function createControllers(services) {
  const deps = { orderService: services.order, bulkService: services.bulk, operatorService: services.operator };
  return {
    order: createOrderController(deps),
    bulk: createBulkController(deps),
    operator: createOperatorController(deps),
    courier: createCourierController(deps),
    health: createHealthController(deps),
  };
}
