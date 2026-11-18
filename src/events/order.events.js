import { logger } from '../utils/logger.js';

export const ORDER_EVENTS = {
  CREATED: 'order.created',
  FAILED: 'order.failed',
  CANCELLED: 'order.cancelled',
};

export function registerOrderEventHandlers(bus, { trackingEventRepository }) {
  bus.on(ORDER_EVENTS.CREATED, ({ orderId, response }) =>
    trackingEventRepository.append(orderId, [
      {
        source: 'SYSTEM',
        status: 'CREATED',
        courierStatus: 'CREATED',
        description: 'Shipment created with courier',
        occurredAt: new Date().toISOString(),
        raw: response,
      },
    ]),
  );

  bus.on(ORDER_EVENTS.CANCELLED, ({ orderId, description, raw }) =>
    trackingEventRepository.append(orderId, [
      {
        source: 'SYSTEM',
        status: 'CANCELLED',
        courierStatus: 'CANCELLED',
        description,
        occurredAt: new Date().toISOString(),
        raw,
      },
    ]),
  );

  bus.on(ORDER_EVENTS.FAILED, ({ orderId, courierPartner, error, cause, needsReconciliation }) => {
    logger.error(
      { order_id: orderId, courier_partner: courierPartner, error_type: error.code, needs_reconciliation: needsReconciliation, err: cause },
      'create shipment failed',
    );
  });
}
