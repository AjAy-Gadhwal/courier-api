import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../utils/errors.js';

export function apiKeyAuth(apiKey) {
  return (req, _res, next) => {
    if (!apiKey) return next();
    const received = Buffer.from(req.header('x-api-key') ?? '');
    const expected = Buffer.from(apiKey);
    if (received.length === expected.length && timingSafeEqual(received, expected)) return next();
    next(new AppError('UNAUTHORIZED', 'Missing or invalid x-api-key'));
  };
}
