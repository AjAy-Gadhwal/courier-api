import { normalizeStatus } from '../../../utils/status.js';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

export function findFirst(source, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  const walk = (node, depth) => {
    if (depth > 6 || node === null || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    for (const [key, value] of Object.entries(node)) {
      if (wanted.has(key.toLowerCase()) && value !== null && value !== '' && typeof value !== 'object') return value;
    }
    for (const value of Object.values(node)) {
      const found = walk(value, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  return walk(source, 0);
}

export function buildAuthBody(config) {
  return { [config.authUserField]: config.username, password: config.password };
}

export function extractToken(body) {
  const token = findFirst(body, ['access_token', 'token', 'access', 'key', 'jwt']);
  if (typeof token !== 'string') return undefined;
  const ttl = Number(findFirst(body, ['expires_in', 'expiresIn']));
  return { token, ttlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : undefined };
}

const toParty = (address) => ({
  name: address.name,
  phone: address.phone,
  email: address.email,
  address: [address.line1, address.line2].filter(Boolean).join(', '),
  city: address.city,
  state: address.state,
  pincode: address.pincode,
  country: address.country,
});

export function buildManifestPayload(order, config) {
  const itemsValue = order.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  return {
    customer_code: order.courier_options?.customer_code ?? config.customerCode,
    service_type: order.service_type ?? config.serviceType,
    order_number: order.order_id,
    payment_mode: order.payment.mode,
    cod_amount: order.payment.mode === 'COD' ? order.payment.cod_amount : 0,
    invoice_value: order.payment.declared_value ?? itemsValue,
    weight: order.shipment.weight_kg,
    length: order.shipment.length_cm,
    breadth: order.shipment.breadth_cm,
    height: order.shipment.height_cm,
    pieces: order.shipment.pieces,
    pickup: toParty(order.pickup_address),
    consignee: toParty(order.delivery_address),
    items: order.items.map((item) => ({
      sku: item.sku,
      description: item.name,
      quantity: item.quantity,
      price: item.unit_price,
    })),
    ...order.courier_options?.extra,
  };
}

export function extractCreated(body) {
  const awb = findFirst(body, ['awb', 'awb_number', 'awbno', 'awb_no', 'waybill', 'waybill_number', 'tracking_number']);
  const id = findFirst(body, ['order_id', 'orderid', 'manifest_id', 'shipment_id', 'id']);
  const label = findFirst(body, ['label_url', 'label', 'labelurl']);
  return {
    awb: awb !== undefined ? String(awb) : undefined,
    courierOrderId: id !== undefined ? String(id) : null,
    labelUrl: typeof label === 'string' && label.startsWith('http') ? label : null,
  };
}

export function buildCancelPayload(awb, orderId, reason) {
  return { awb, order_number: orderId, ...(reason ? { reason } : {}) };
}

export function mapError(status, body) {
  const text = JSON.stringify(body ?? '').toLowerCase();
  const failedBody =
    isObject(body) && (body.success === false || body.status === false || /^(fail|error)/i.test(String(body.status ?? '')));

  if (status >= 200 && status < 300 && !failedBody) return undefined;
  if (status >= 500) return undefined;

  if (/pincode|pin code|serviceab/.test(text)) {
    return { code: 'COURIER_UNSERVICEABLE', message: 'Courier does not service the given pincode(s)' };
  }
  if (/duplicate|already exist|already manifest/.test(text)) {
    return { code: 'COURIER_CONFLICT', message: 'Courier reports this order already exists' };
  }
  if (/not found|invalid awb|no such/.test(text)) {
    return { code: 'COURIER_SHIPMENT_NOT_FOUND', message: 'Courier could not find the requested shipment' };
  }
  if (/already cancel|cannot cancel|not allowed to cancel|picked|dispatched/.test(text) && /cancel/.test(text)) {
    return { code: 'COURIER_REJECTED', message: 'Courier refused to cancel this shipment in its current state' };
  }
  if (failedBody) return { code: 'COURIER_VALIDATION_ERROR', message: 'Courier rejected the shipment data' };
  return undefined;
}

const EVENT_KEYS = ['status', 'scan', 'activity', 'event', 'status_code', 'remarks'];

function findEventRows(body) {
  const looksLikeEvents = (list) =>
    list.length > 0 &&
    list.every(isObject) &&
    list.some((row) => EVENT_KEYS.some((key) => key in row || key.toUpperCase() in row));

  const walk = (node, depth) => {
    if (depth > 5 || node === null || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      if (looksLikeEvents(node)) return node;
      for (const child of node) {
        const found = walk(child, depth + 1);
        if (found) return found;
      }
      return undefined;
    }
    for (const value of Object.values(node)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return undefined;
  };

  return walk(body, 0) ?? [];
}

const toIso = (value) => {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export function extractTrackingEvents(body) {
  const events = findEventRows(body).map((row) => {
    const courierStatus = String(findFirst(row, ['status', 'scan', 'activity', 'event', 'status_code']) ?? 'UNKNOWN');
    const description = findFirst(row, ['remarks', 'remark', 'description', 'message', 'status_description']);
    return {
      status: normalizeStatus(`${courierStatus} ${description ?? ''}`),
      courierStatus,
      description: description !== undefined ? String(description) : undefined,
      location: findFirst(row, ['location', 'city', 'hub', 'scan_location']),
      occurredAt: toIso(findFirst(row, ['timestamp', 'datetime', 'date_time', 'time', 'date', 'created_at', 'status_date'])),
      raw: row,
    };
  });
  if (events.length) return events;

  const current = findFirst(body, ['current_status', 'status', 'shipment_status']);
  if (current === undefined) return [];
  return [
    {
      status: normalizeStatus(String(current)),
      courierStatus: String(current),
      occurredAt: new Date().toISOString(),
      raw: body,
    },
  ];
}
