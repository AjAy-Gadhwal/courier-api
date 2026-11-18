import { ORDER_EVENTS } from '../events/index.js';
import { AppError, ValidationError, toAppError } from '../utils/errors.js';
import { getRequestId, logger } from '../utils/logger.js';

const NO_REFRESH_STATUSES = ['DELIVERED', 'CANCELLED', 'RTO'];

const inProgress = (orderId) =>
  new AppError('ORDER_IN_PROGRESS', `Order '${orderId}' is currently being processed`, undefined, { retryable: true });

export class OrderService {
  constructor({ registry, orderRepository, trackingEventRepository, events }) {
    this.registry = registry;
    this.orders = orderRepository;
    this.trackingEvents = trackingEventRepository;
    this.events = events;
  }

  supportedCouriers() {
    return this.registry.supported();
  }

  async getOrThrow(orderId) {
    const order = await this.orders.find(orderId);
    if (!order) throw new AppError('ORDER_NOT_FOUND', `Order '${orderId}' not found`);
    return order;
  }

  list(filter) {
    return this.orders.list(filter);
  }

  async createOrder(input) {
    const adapter = this.registry.resolve(input.courier_partner);
    const orderId = input.order_id;

    if (!(await this.orders.claim(input))) {
      const existing = await this.getOrThrow(orderId);
      if (existing.courierPartner !== input.courier_partner) {
        throw new AppError('ORDER_ID_CONFLICT', `order_id '${orderId}' already exists with a different courier_partner`);
      }
      if (existing.status === 'PENDING') throw inProgress(orderId);
      if (existing.status !== 'FAILED' || existing.awbNumber) return { order: existing, replayed: true };

      if (!(await this.orders.reclaimFailed(orderId, input))) throw inProgress(orderId);
      logger.info({ order_id: orderId, courier_partner: input.courier_partner }, 'retrying previously failed order');
    }

    try {
      const result = await adapter.createShipment(input, { orderId, requestId: getRequestId() });
      await this.orders.markCreated(orderId, {
        courierOrderId: result.courierOrderId,
        awb: result.awb,
        labelUrl: result.labelUrl,
        request: result.audit.request,
        response: result.audit.response,
      });
      await this.events.emit(ORDER_EVENTS.CREATED, {
        orderId,
        courierPartner: input.courier_partner,
        awb: result.awb,
        response: result.audit.response,
      });
      logger.info({ order_id: orderId, courier_partner: input.courier_partner, awb: result.awb }, 'shipment created');
      return { order: await this.getOrThrow(orderId), replayed: false };
    } catch (cause) {
      const error = toAppError(cause);
      const needsReconciliation = error.retryable || error.code === 'INTERNAL_ERROR';
      await this.orders.markFailed(orderId, {
        code: error.code,
        message: error.message,
        needsReconciliation,
        request: error.audit?.request,
        response: error.audit?.response,
      });
      await this.events.emit(ORDER_EVENTS.FAILED, {
        orderId,
        courierPartner: input.courier_partner,
        error,
        cause,
        needsReconciliation,
      });
      throw error;
    }
  }

  async track(orderId, refresh = true) {
    let order = await this.getOrThrow(orderId);
    let refreshed = false;

    if (refresh && order.awbNumber && !NO_REFRESH_STATUSES.includes(order.status)) {
      const adapter = this.registry.resolve(order.courierPartner);
      try {
        const result = await adapter.track(
          { orderId, awb: order.awbNumber, courierOrderId: order.courierOrderId },
          { orderId, requestId: getRequestId() },
        );
        await this.trackingEvents.append(orderId, result.events.map((event) => ({ source: 'COURIER', ...event })));
        await this.orders.updateStatus(orderId, result.status, result.audit);
        refreshed = true;
      } catch (cause) {
        const error = toAppError(cause);
        logger.error(
          { order_id: orderId, courier_partner: order.courierPartner, error_type: error.code, err: cause },
          'track shipment failed',
        );
        throw error;
      }
      order = await this.getOrThrow(orderId);
    }

    return { order, events: await this.trackingEvents.list(orderId), refreshed };
  }

  async cancel(orderId, { courier_partner: courierPartner, reason } = {}) {
    const order = await this.getOrThrow(orderId);

    if (courierPartner && courierPartner.toLowerCase() !== order.courierPartner) {
      throw new ValidationError([{ field: 'courier_partner', message: 'does not match the courier used for this order' }]);
    }
    if (order.status === 'CANCELLED') return { order, replayed: true };
    if (order.status === 'PENDING') throw inProgress(orderId);
    if (order.status === 'DELIVERED' || order.status === 'RTO') {
      throw new AppError('INVALID_ORDER_STATE', `Order in status ${order.status} cannot be cancelled`);
    }

    if (!order.awbNumber) {
      if (order.needsReconciliation) {
        throw new AppError('INVALID_ORDER_STATE', 'Order has an unknown courier outcome; reconcile it before cancelling');
      }
      await this.orders.updateStatus(orderId, 'CANCELLED');
      await this.events.emit(ORDER_EVENTS.CANCELLED, { orderId, description: 'Cancelled before shipment was created' });
      return { order: await this.getOrThrow(orderId), replayed: false };
    }

    const adapter = this.registry.resolve(order.courierPartner);
    try {
      const result = await adapter.cancel(
        { orderId, awb: order.awbNumber, courierOrderId: order.courierOrderId },
        { orderId, requestId: getRequestId(), reason },
      );
      await this.orders.updateStatus(orderId, 'CANCELLED', result.audit);
      await this.events.emit(ORDER_EVENTS.CANCELLED, {
        orderId,
        description: reason ?? 'Cancelled by request',
        raw: result.audit.response,
      });
      logger.info({ order_id: orderId, courier_partner: order.courierPartner }, 'shipment cancelled');
      return { order: await this.getOrThrow(orderId), replayed: false };
    } catch (cause) {
      const error = toAppError(cause);
      logger.error(
        { order_id: orderId, courier_partner: order.courierPartner, error_type: error.code, err: cause },
        'cancel shipment failed',
      );
      throw error;
    }
  }
}
