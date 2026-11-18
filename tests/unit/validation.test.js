import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/utils/errors.js';
import { parseWith } from '../../src/utils/validate.js';
import { operatorPatchSchema } from '../../src/validations/operator.validation.js';
import { createOrderSchema } from '../../src/validations/order.validation.js';
import { sampleOrder } from '../helpers/index.js';

describe('createOrderSchema', () => {
  it('lower-cases courier_partner and applies defaults', () => {
    const order = parseWith(createOrderSchema, sampleOrder('A-1', 'UrbaneBolt'));
    expect(order.courier_partner).toBe('urbanebolt');
    expect(order.shipment.pieces).toBe(1);
    expect(order.delivery_address.country).toBe('IN');
  });

  it('requires cod_amount for COD orders', () => {
    const input = sampleOrder('A-2', 'mock', { payment: { mode: 'COD' } });
    expect(() => parseWith(createOrderSchema, input)).toThrow(ValidationError);
  });

  it('rejects unsafe order ids', () => {
    expect(() => parseWith(createOrderSchema, sampleOrder('bad id/1'))).toThrow(ValidationError);
  });
});

describe('operatorPatchSchema', () => {
  it('accepts partial runtime overrides', () => {
    expect(parseWith(operatorPatchSchema, { runtime: { timeoutMs: 2000 } }).runtime.timeoutMs).toBe(2000);
  });

  it('rejects out of range retries', () => {
    expect(() => parseWith(operatorPatchSchema, { runtime: { maxRetries: 99 } })).toThrow(ValidationError);
  });
});
