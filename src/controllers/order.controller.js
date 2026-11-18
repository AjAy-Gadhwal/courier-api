import { eventView, orderView } from '../utils/serializers.js';
import { sendSuccess } from '../utils/response.js';

export function createOrderController({ orderService }) {
  return {
    async create(req, res) {
      const { order, replayed } = await orderService.createOrder(req.valid.body);
      sendSuccess(res, { ...orderView(order), idempotent_replay: replayed }, replayed ? 200 : 201);
    },

    async list(req, res) {
      const { status, courier_partner: courier, needs_reconciliation: reconcile, limit, offset } = req.valid.query;
      const orders = await orderService.list({
        status,
        courier: courier?.toLowerCase(),
        needsReconciliation: reconcile === undefined ? undefined : reconcile === 'true',
        limit,
        offset,
      });
      sendSuccess(res, { orders: orders.map(orderView), limit, offset });
    },

    async getOne(req, res) {
      sendSuccess(res, orderView(await orderService.getOrThrow(req.params.orderId)));
    },

    async track(req, res) {
      const { order, events, refreshed } = await orderService.track(req.params.orderId, req.valid.query.refresh === 'true');
      sendSuccess(res, { ...orderView(order), refreshed, events: events.map(eventView) });
    },

    async cancel(req, res) {
      const { order, replayed } = await orderService.cancel(req.params.orderId, req.valid.body);
      sendSuccess(res, { ...orderView(order), idempotent_replay: replayed });
    },
  };
}
