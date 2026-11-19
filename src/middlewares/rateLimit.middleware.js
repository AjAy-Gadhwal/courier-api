import { createHash } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

const passThrough = (_req, _res, next) => next();

const clientKey = (req) => {
  const apiKey = req.header('x-api-key');
  if (apiKey) return `key:${createHash('sha256').update(apiKey).digest('hex').slice(0, 16)}`;
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

const buildLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: clientKey,
    handler: (req, _res, next, options) => {
      const resetAt = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetAt
        ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      next(new AppError('RATE_LIMITED', 'Too many requests, please slow down', { retry_after_seconds: retryAfterSeconds }));
    },
  });

export function createRateLimiters(config) {
  if (!config.enabled) return { general: passThrough, strict: passThrough };
  return {
    general: buildLimiter({ windowMs: config.windowMs, limit: config.max }),
    strict: buildLimiter({ windowMs: config.windowMs, limit: config.strictMax }),
  };
}
