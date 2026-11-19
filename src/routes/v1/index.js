import { Router } from 'express';
import { createBulkRoutes } from './bulk.routes.js';
import { createCourierRoutes } from './courier.routes.js';
import { createOperatorRoutes } from './operator.routes.js';
import { createOrderRoutes } from './order.routes.js';

export function createV1Routes(controllers, limiters) {
  const router = Router();

  router.use('/couriers', createCourierRoutes(controllers));
  router.use('/operators', createOperatorRoutes(controllers, limiters));
  router.use('/orders/bulk', createBulkRoutes(controllers, limiters));
  router.use('/orders', createOrderRoutes(controllers));

  return router;
}
