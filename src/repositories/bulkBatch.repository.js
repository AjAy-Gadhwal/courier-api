const toItem = (row) => {
  const i = row.get();
  return {
    idx: i.idx,
    orderId: i.orderId,
    courierPartner: i.courierPartner,
    status: i.status,
    errorCode: i.errorCode,
    errorMessage: i.errorMessage,
    errorDetails: i.errorDetails,
    payload: i.payload,
  };
};

export class BulkBatchRepository {
  constructor(models) {
    this.models = models;
  }

  async create(batchId, requestId, items) {
    const { BulkBatch, BulkBatchItem } = this.models;
    await BulkBatch.sequelize.transaction(async (transaction) => {
      await BulkBatch.create(
        { batchId, requestId: requestId ?? null, status: 'PROCESSING', total: items.length },
        { transaction },
      );
      await BulkBatchItem.bulkCreate(
        items.map((item) => ({
          batchId,
          idx: item.idx,
          orderId: item.orderId,
          courierPartner: item.courierPartner,
          status: item.status,
          errorCode: item.error?.code ?? null,
          errorMessage: item.error?.message.slice(0, 500) ?? null,
          errorDetails: item.error?.details ?? null,
          payload: item.payload ?? null,
        })),
        { transaction },
      );
    });
  }

  async pendingItems(batchId) {
    const rows = await this.models.BulkBatchItem.findAll({
      where: { batchId, status: 'PENDING' },
      order: [['idx', 'ASC']],
    });
    return rows.map(toItem);
  }

  async markItem(batchId, idx, status, error) {
    await this.models.BulkBatchItem.update(
      {
        status,
        errorCode: error?.code ?? null,
        errorMessage: error?.message.slice(0, 500) ?? null,
        errorDetails: error?.details ?? null,
      },
      { where: { batchId, idx } },
    );
  }

  async finalizeIfDone(batchId) {
    const pending = await this.models.BulkBatchItem.count({ where: { batchId, status: 'PENDING' } });
    if (pending > 0) return false;
    const [affected] = await this.models.BulkBatch.update(
      { status: 'COMPLETED', completedAt: new Date() },
      { where: { batchId, status: 'PROCESSING' } },
    );
    return affected === 1;
  }

  async get(batchId) {
    const batch = await this.models.BulkBatch.findByPk(batchId);
    if (!batch) return undefined;

    const rows = await this.models.BulkBatchItem.findAll({ where: { batchId }, order: [['idx', 'ASC']] });
    const items = rows.map(toItem);

    const succeededIds = items.filter((i) => i.status === 'SUCCEEDED' && i.orderId).map((i) => i.orderId);
    const orders = succeededIds.length
      ? await this.models.Order.findAll({
          where: { orderId: succeededIds },
          attributes: ['orderId', 'awbNumber', 'courierOrderId', 'status'],
        })
      : [];
    const ordersById = new Map(orders.map((o) => [o.get().orderId, o.get()]));
    for (const item of items) {
      const order = ordersById.get(item.orderId);
      if (order) {
        item.awbNumber = order.awbNumber;
        item.courierOrderId = order.courierOrderId;
        item.orderStatus = order.status;
      }
    }

    const b = batch.get();
    const count = (status) => items.filter((i) => i.status === status).length;
    return {
      batchId: b.batchId,
      status: b.status,
      total: b.total,
      succeeded: count('SUCCEEDED'),
      failed: count('FAILED'),
      pending: count('PENDING'),
      createdAt: new Date(b.createdAt).toISOString(),
      completedAt: b.completedAt ? new Date(b.completedAt).toISOString() : null,
      items,
    };
  }

  async openBatchIds() {
    const rows = await this.models.BulkBatchItem.findAll({
      where: { status: 'PENDING' },
      attributes: ['batchId'],
      group: ['batchId'],
    });
    return rows.map((row) => row.get().batchId);
  }
}
