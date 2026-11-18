import { literal, UniqueConstraintError } from 'sequelize';

const toRecord = (row) => {
  const o = row.get();
  return {
    orderId: o.orderId,
    courierPartner: o.courierPartner,
    courierOrderId: o.courierOrderId,
    awbNumber: o.awbNumber,
    status: o.status,
    labelUrl: o.labelUrl,
    normalizedPayload: o.normalizedPayload,
    courierRequest: o.courierRequest,
    courierResponse: o.courierResponse,
    failureCode: o.failureCode,
    failureMessage: o.failureMessage,
    needsReconciliation: Boolean(o.needsReconciliation),
    attempts: o.attempts,
    createdAt: new Date(o.createdAt).toISOString(),
    updatedAt: new Date(o.updatedAt).toISOString(),
  };
};

export class OrderRepository {
  constructor(models) {
    this.Order = models.Order;
  }

  async claim(order) {
    try {
      await this.Order.create({
        orderId: order.order_id,
        courierPartner: order.courier_partner,
        status: 'PENDING',
        normalizedPayload: order,
      });
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintError) return false;
      throw error;
    }
  }

  async reclaimFailed(orderId, order) {
    const [affected] = await this.Order.update(
      {
        status: 'PENDING',
        normalizedPayload: order,
        failureCode: null,
        failureMessage: null,
        attempts: literal('attempts + 1'),
      },
      { where: { orderId, status: 'FAILED', awbNumber: null } },
    );
    return affected === 1;
  }

  async find(orderId) {
    const row = await this.Order.findByPk(orderId);
    return row ? toRecord(row) : undefined;
  }

  async markCreated(orderId, { courierOrderId, awb, labelUrl, request, response }) {
    await this.Order.update(
      {
        status: 'CREATED',
        courierOrderId,
        awbNumber: awb,
        labelUrl: labelUrl ?? null,
        courierRequest: request,
        courierResponse: response,
        failureCode: null,
        failureMessage: null,
        needsReconciliation: false,
      },
      { where: { orderId } },
    );
  }

  async markFailed(orderId, { code, message, needsReconciliation, request, response }) {
    await this.Order.update(
      {
        status: 'FAILED',
        failureCode: code,
        failureMessage: message.slice(0, 500),
        needsReconciliation,
        ...(request !== undefined ? { courierRequest: request } : {}),
        ...(response !== undefined ? { courierResponse: response } : {}),
      },
      { where: { orderId } },
    );
  }

  async updateStatus(orderId, status, audit) {
    await this.Order.update(
      { status, ...(audit?.response !== undefined ? { courierResponse: audit.response } : {}) },
      { where: { orderId } },
    );
  }

  async list({ status, courier, needsReconciliation, limit, offset }) {
    const where = {};
    if (status) where.status = status;
    if (courier) where.courierPartner = courier;
    if (needsReconciliation !== undefined) where.needsReconciliation = needsReconciliation;
    const rows = await this.Order.findAll({ where, order: [['createdAt', 'DESC']], limit, offset });
    return rows.map(toRecord);
  }

  async failInterrupted() {
    const [affected] = await this.Order.update(
      {
        status: 'FAILED',
        failureCode: 'INTERRUPTED',
        failureMessage: 'Process stopped while the courier call was in flight',
        needsReconciliation: true,
      },
      { where: { status: 'PENDING' } },
    );
    return affected;
  }
}
