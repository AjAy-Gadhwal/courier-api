import { Router } from 'express';

export function createBulkRoutes({ bulk }) {
  const router = Router();

  router.post('/', bulk.submit);
  router.get('/:batchId', bulk.status);

  return router;
}
