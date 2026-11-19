import { Router } from 'express';
import { apiKeyAuth } from '../middlewares/apiKey.middleware.js';
import { createRateLimiters } from '../middlewares/rateLimit.middleware.js';
import { createV1Routes } from './v1/index.js';

export function createRoutes({ controllers, config }) {
  const router = Router();
  const limiters = createRateLimiters(config.rateLimit);

  router.get('/health', controllers.health.check);
  router.use('/api/v1', apiKeyAuth(config.apiKey), limiters.general, createV1Routes(controllers, limiters));

  return router;
}
