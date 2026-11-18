export const orderView = (order) => ({
  order_id: order.orderId,
  courier_partner: order.courierPartner,
  courier_order_id: order.courierOrderId,
  awb_number: order.awbNumber,
  status: order.status,
  label_url: order.labelUrl,
  failure: order.failureCode ? { code: order.failureCode, message: order.failureMessage } : null,
  needs_reconciliation: order.needsReconciliation,
  attempts: order.attempts,
  created_at: order.createdAt,
  updated_at: order.updatedAt,
});

export const eventView = (event) => ({
  status: event.status,
  courier_status: event.courierStatus,
  description: event.description,
  location: event.location,
  occurred_at: event.occurredAt,
  recorded_at: event.recordedAt,
  source: event.source,
});

export const operatorView = (operator) => ({
  code: operator.code,
  display_name: operator.displayName,
  enabled: operator.enabled,
  active: operator.active,
  settings: operator.settings,
  runtime: operator.runtime,
  credentials_env: operator.credentialsEnv,
  updated_at: operator.updatedAt,
});

export const batchView = (batch) => ({
  batch_id: batch.batchId,
  status: batch.status,
  total: batch.total,
  succeeded: batch.succeeded,
  failed: batch.failed,
  pending: batch.pending,
  created_at: batch.createdAt,
  completed_at: batch.completedAt,
  results: batch.items.map((item) => ({
    index: item.idx,
    order_id: item.orderId,
    courier_partner: item.courierPartner,
    status: item.status,
    awb_number: item.awbNumber ?? null,
    courier_order_id: item.courierOrderId ?? null,
    shipment_status: item.orderStatus ?? null,
    error: item.errorCode
      ? { code: item.errorCode, message: item.errorMessage, details: item.errorDetails ?? undefined }
      : null,
  })),
});
