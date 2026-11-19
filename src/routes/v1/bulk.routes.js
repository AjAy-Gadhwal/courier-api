import { Router } from 'express';

export function createBulkRoutes({ bulk }, { strict }) {
  const router = Router();

  router.post('/', strict, bulk.submit);
  router.get('/:batchId', bulk.status);

  return router;
}
