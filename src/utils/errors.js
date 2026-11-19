export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_JSON: 400,
  UNKNOWN_COURIER: 400,
  BATCH_TOO_LARGE: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  ORDER_NOT_FOUND: 404,
  BATCH_NOT_FOUND: 404,
  OPERATOR_NOT_FOUND: 404,
  ORDER_ID_CONFLICT: 409,
  ORDER_IN_PROGRESS: 409,
  INVALID_ORDER_STATE: 409,
  COURIER_VALIDATION_ERROR: 422,
  COURIER_UNSERVICEABLE: 422,
  COURIER_REJECTED: 422,
  COURIER_SHIPMENT_NOT_FOUND: 404,
  COURIER_CONFLICT: 409,
  COURIER_AUTH_FAILED: 502,
  COURIER_UNAVAILABLE: 502,
  COURIER_RATE_LIMITED: 503,
  COURIER_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  constructor(code, message, details, { retryable = false, cause, audit, courier } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.retryable = retryable;
    this.audit = audit;
    this.courier = courier;
  }
}

export class ValidationError extends AppError {
  constructor(details, message = 'Request validation failed') {
    super('VALIDATION_ERROR', message, details);
  }
}

export function toAppError(error) {
  if (error instanceof AppError) return error;
  const cause = error instanceof Error ? error : new Error(String(error));
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred', undefined, { cause });
}

export function toErrorBody(error, requestId) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
      ...(requestId ? { request_id: requestId } : {}),
    },
  };
}
