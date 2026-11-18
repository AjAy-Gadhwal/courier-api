import { describe, expect, it } from 'vitest';
import { normalizeStatus } from '../../src/utils/status.js';

describe('normalizeStatus', () => {
  it.each([
    ['Manifested', 'CREATED'],
    ['Picked Up', 'PICKED_UP'],
    ['Shipment in transit', 'IN_TRANSIT'],
    ['Out For Delivery', 'OUT_FOR_DELIVERY'],
    ['Delivered', 'DELIVERED'],
    ['Delivery attempt failed', 'UNDELIVERED'],
    ['RTO initiated', 'RTO'],
    ['Cancelled by seller', 'CANCELLED'],
  ])('maps "%s" to %s', (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  it('falls back to IN_TRANSIT for unknown text', () => {
    expect(normalizeStatus('something odd')).toBe('IN_TRANSIT');
  });
});
