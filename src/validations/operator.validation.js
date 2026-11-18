import { z } from 'zod';

export const runtimeSchema = z.object({
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0).max(10),
  retryBaseMs: z.number().int().min(0),
  retryMaxMs: z.number().int().min(0),
});

export const credentialsEnvSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
});

export const operatorPatchSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  runtime: runtimeSchema.partial().optional(),
  credentials_env: credentialsEnvSchema.optional(),
});
