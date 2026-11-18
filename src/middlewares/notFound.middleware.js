import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl.split('?')[0]} not found`));
}
