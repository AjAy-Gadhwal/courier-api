export const SHIPMENT_STATUSES = [
  'PENDING',
  'CREATED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'UNDELIVERED',
  'RTO',
  'CANCELLED',
  'FAILED',
];

const RULES = [
  [/cancel/i, 'CANCELLED'],
  [/\brto\b|return(ed)? to (origin|seller|shipper)|returned/i, 'RTO'],
  [/undeliver|not delivered|\bndr\b|attempt(ed)? (failed|unsuccessful)|delivery failed/i, 'UNDELIVERED'],
  [/out[\s_-]*for[\s_-]*delivery|\bofd\b/i, 'OUT_FOR_DELIVERY'],
  [/deliver(ed)?/i, 'DELIVERED'],
  [/pick(ed)?[\s_-]*up|picked|collected/i, 'PICKED_UP'],
  [/transit|dispatch|shipped|reached|arrived|hub|bagged|departed|in[\s_-]?scan|out[\s_-]?scan/i, 'IN_TRANSIT'],
  [/manifest|creat|book|placed|pending|awaiting|schedul|ready|new/i, 'CREATED'],
];

export function normalizeStatus(text) {
  const value = String(text ?? '');
  for (const [pattern, status] of RULES) {
    if (pattern.test(value)) return status;
  }
  return 'IN_TRANSIT';
}
