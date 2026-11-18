import { Router } from 'express';

export function createCourierRoutes({ courier }) {
  const router = Router();
  router.get('/', courier.list);
  return router;
}
