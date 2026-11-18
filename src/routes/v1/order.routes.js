import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  trackQuerySchema,
} from '../../validations/order.validation.js';

export function createOrderRoutes({ order }) {
  const router = Router();

  router.post('/', validate({ body: createOrderSchema }), order.create);
  router.get('/', validate({ query: listOrdersQuerySchema }), order.list);
  router.get('/:orderId', order.getOne);
  router.get('/:orderId/track', validate({ query: trackQuerySchema }), order.track);
  router.post('/:orderId/cancel', validate({ body: cancelOrderSchema }), order.cancel);

  return router;
}
