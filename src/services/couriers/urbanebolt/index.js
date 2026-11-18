import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { CourierHttpClient } from '../shared/httpClient.js';
import { TokenAuth } from '../shared/tokenAuth.js';
import { loadUrbaneBoltConfig } from './config.js';
import {
  buildAuthBody,
  buildCancelPayload,
  buildManifestPayload,
  extractCreated,
  extractToken,
  extractTrackingEvents,
  mapError,
} from './mapper.js';

const CODE = 'urbanebolt';

class UrbaneBoltAdapter {
  constructor(config, runtime) {
    this.code = CODE;
    this.config = config;

    const base = { courier: CODE, baseURL: config.baseUrl, ...runtime };
    const authClient = new CourierHttpClient(base);
    const auth = new TokenAuth(
      async () => {
        const res = await authClient.request({ method: 'POST', path: config.authPath, body: buildAuthBody(config) });
        const token = extractToken(res.data);
        if (!token) {
          throw new AppError('COURIER_AUTH_FAILED', 'Courier authentication returned no token', { courier: CODE }, { courier: CODE });
        }
        logger.info({ courier: CODE }, 'courier token refreshed');
        return token;
      },
      { scheme: config.authScheme, defaultTtlSeconds: config.tokenTtlSeconds },
    );

    this.http = new CourierHttpClient({ ...base, auth, errorMapper: mapError });
  }

  async createShipment(order, { requestId }) {
    const res = await this.http.request({
      method: 'POST',
      path: this.config.createPath,
      body: buildManifestPayload(order, this.config),
      headers: { 'Idempotency-Key': order.order_id, 'X-Request-Id': requestId ?? '' },
    });

    const created = extractCreated(res.data);
    if (!created.awb) {
      throw new AppError('COURIER_REJECTED', 'Courier accepted the request but returned no AWB', { courier: CODE }, {
        courier: CODE,
        audit: res.audit,
      });
    }
    return { courierOrderId: created.courierOrderId, awb: created.awb, labelUrl: created.labelUrl, audit: res.audit };
  }

  async track({ awb }) {
    const res = await this.http.request({ method: 'GET', path: this.config.trackPath, params: { awb } });
    const events = extractTrackingEvents(res.data).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (!events.length) {
      throw new AppError('COURIER_SHIPMENT_NOT_FOUND', 'Courier returned no tracking information', { courier: CODE }, {
        courier: CODE,
        audit: res.audit,
      });
    }
    return { status: events[events.length - 1].status, events, audit: res.audit };
  }

  async cancel({ awb }, { orderId, reason }) {
    const res = await this.http.request({
      method: 'POST',
      path: this.config.cancelPath,
      body: buildCancelPayload(awb, orderId, reason),
    });
    return { cancelled: true, audit: res.audit };
  }
}

export default {
  code: CODE,
  displayName: 'UrbaneBolt',
  enabled: (ctx) => Boolean(ctx.credentials.username || ctx.credentials.password),
  create: (ctx) => new UrbaneBoltAdapter(loadUrbaneBoltConfig(ctx), ctx.runtime),
};
