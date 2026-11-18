import axios from 'axios';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { sleep } from '../../../utils/sleep.js';

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ERR_NETWORK',
]);

export class CourierHttpClient {
  constructor(options) {
    this.options = options;
  }

  async request({ method, path, params, body, headers }) {
    const { baseURL, auth, errorMapper, defaultHeaders, timeoutMs, maxRetries } = this.options;
    const url = `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
    const auditRequest = { method, url, params, body };
    let attempt = 0;
    let forceRefresh = false;
    let reauthenticated = false;

    for (;;) {
      try {
        const authHeaders = auth ? await auth.getHeaders(forceRefresh) : {};
        forceRefresh = false;

        const res = await axios.request({
          method,
          url,
          params,
          data: body,
          timeout: timeoutMs,
          headers: { 'Content-Type': 'application/json', ...defaultHeaders, ...authHeaders, ...headers },
          validateStatus: () => true,
        });
        const audit = { request: auditRequest, response: { status: res.status, body: res.data } };

        if (res.status === 401 && auth && !reauthenticated) {
          reauthenticated = true;
          forceRefresh = true;
          logger.warn({ courier: this.options.courier, path }, 'courier returned 401, re-authenticating once');
          continue;
        }

        if (res.status >= 200 && res.status < 300) {
          const bodyError = errorMapper?.(res.status, res.data);
          if (bodyError) throw this.fail(bodyError.code, bodyError.message, audit, false);
          return { status: res.status, data: res.data, audit };
        }

        throw this.classifyHttpError(res.status, res.data, audit);
      } catch (error) {
        const appError = this.toAppError(error, auditRequest);
        if (!appError.retryable || attempt >= maxRetries) throw appError;

        attempt += 1;
        const delay = this.backoff(attempt);
        logger.warn(
          { courier: this.options.courier, path, attempt, max_retries: maxRetries, delay_ms: delay, error_type: appError.code },
          'courier call failed, retrying',
        );
        await sleep(delay);
      }
    }
  }

  backoff(attempt) {
    const { retryBaseMs, retryMaxMs } = this.options;
    const cap = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
    return Math.floor(Math.random() * cap) + (cap > 0 ? 1 : 0);
  }

  fail(code, message, audit, retryable, cause) {
    const { courier } = this.options;
    return new AppError(code, message, { courier }, { retryable, audit, courier, cause });
  }

  classifyHttpError(status, body, audit) {
    logger.warn({ courier: this.options.courier, courier_status: status, courier_body: body }, 'courier returned error status');

    const mapped = this.options.errorMapper?.(status, body);
    if (mapped) return this.fail(mapped.code, mapped.message, audit, false);

    if (status === 401 || status === 403) return this.fail('COURIER_AUTH_FAILED', 'Authentication with courier failed', audit, false);
    if (status === 404) return this.fail('COURIER_SHIPMENT_NOT_FOUND', 'Courier could not find the requested resource', audit, false);
    if (status === 409) return this.fail('COURIER_CONFLICT', 'Courier reported a conflict (possible duplicate)', audit, false);
    if (status === 429) return this.fail('COURIER_RATE_LIMITED', 'Courier rate limit hit', audit, true);
    if (status >= 500) return this.fail('COURIER_UNAVAILABLE', 'Courier service is unavailable', audit, true);
    if (status === 400 || status === 422) return this.fail('COURIER_VALIDATION_ERROR', 'Courier rejected the shipment data', audit, false);
    return this.fail('COURIER_REJECTED', 'Courier rejected the request', audit, false);
  }

  toAppError(error, auditRequest) {
    if (error instanceof AppError) return error;

    const audit = { request: auditRequest, response: { error: error?.message } };
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(error?.message ?? '')) {
      return this.fail('COURIER_TIMEOUT', 'Courier request timed out', audit, true, error);
    }
    if (error?.code && TRANSIENT_NETWORK_CODES.has(error.code)) {
      return this.fail('COURIER_UNAVAILABLE', 'Could not reach courier', audit, true, error);
    }
    return new AppError('INTERNAL_ERROR', 'Unexpected error while calling courier', undefined, {
      cause: error,
      audit,
      courier: this.options.courier,
    });
  }
}
