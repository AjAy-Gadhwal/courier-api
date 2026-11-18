import { Router } from 'express';
import { apiKeyAuth } from '../middlewares/apiKey.middleware.js';
import { createV1Routes } from './v1/index.js';

export function createRoutes({ controllers, config }) {
  const router = Router();

  router.get('/health', controllers.health.check);
  router.use('/api/v1', apiKeyAuth(config.apiKey), createV1Routes(controllers));

  return router;
}
