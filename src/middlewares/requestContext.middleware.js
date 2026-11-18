import { randomUUID } from 'node:crypto';
import { logger, requestStore } from '../utils/logger.js';

export function requestContext(req, res, next) {
  const requestId = (req.header('x-request-id') || randomUUID()).slice(0, 100);
  res.setHeader('x-request-id', requestId);

  requestStore.run({ requestId }, () => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info(
        { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, duration_ms: Date.now() - startedAt },
        'request',
      );
    });
    next();
  });
}
