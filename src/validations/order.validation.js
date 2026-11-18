import { z } from 'zod';
import { SHIPMENT_STATUSES } from '../utils/status.js';

const phone = z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'must be 10-15 digits, optional leading +');

export const addressSchema = z.object({
  name: z.string().trim().min(1),
  phone,
  email: z.string().trim().email().optional(),
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, 'must be a 6 digit pincode'),
  country: z.string().trim().length(2).default('IN'),
});

const itemSchema = z.object({
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
});

export const createOrderSchema = z
  .object({
    courier_partner: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toLowerCase()),
    order_id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_.\-]+$/, 'only letters, digits, _ - . allowed'),
    pickup_address: addressSchema,
    delivery_address: addressSchema,
    items: z.array(itemSchema).min(1),
    shipment: z.object({
      weight_kg: z.number().positive(),
      length_cm: z.number().positive(),
      breadth_cm: z.number().positive(),
      height_cm: z.number().positive(),
      pieces: z.number().int().positive().default(1),
    }),
    payment: z.object({
      mode: z.enum(['PREPAID', 'COD']),
      cod_amount: z.number().nonnegative().optional(),
      declared_value: z.number().nonnegative().optional(),
    }),
    service_type: z.string().trim().optional(),
    courier_options: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((order, ctx) => {
    const { mode, cod_amount: codAmount } = order.payment;
    if (mode === 'COD' && (codAmount === undefined || codAmount <= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment', 'cod_amount'],
        message: 'cod_amount is required (> 0) when payment.mode is COD',
      });
    }
  });

export const cancelOrderSchema = z.object({
  courier_partner: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  courier_partner: z.string().optional(),
  needs_reconciliation: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const trackQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).default('true'),
});
