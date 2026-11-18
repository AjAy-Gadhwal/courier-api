import { AppError, toAppError, toErrorBody } from '../utils/errors.js';
import { getRequestId, logger } from '../utils/logger.js';

export function errorHandler(err, _req, res, _next) {
  let error;
  if (err?.type === 'entity.parse.failed') error = new AppError('INVALID_JSON', 'Request body is not valid JSON');
  else if (err?.type === 'entity.too.large') error = new AppError('VALIDATION_ERROR', 'Request body too large');
  else error = toAppError(err);

  if (error.httpStatus >= 500) logger.error({ error_type: error.code, err }, 'request failed');
  else logger.warn({ error_type: error.code, message: error.message }, 'request rejected');

  res.status(error.httpStatus).json(toErrorBody(error, getRequestId()));
}
