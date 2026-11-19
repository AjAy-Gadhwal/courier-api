import express from 'express';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { requestContext } from './middlewares/requestContext.middleware.js';
import { securityHeaders } from './middlewares/security.middleware.js';
import { createRoutes } from './routes/index.js';

export function createApp({ config, controllers }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders());
  app.use(requestContext);
  app.use(express.json({ limit: '5mb' }));
  app.use(createRoutes({ controllers, config }));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
