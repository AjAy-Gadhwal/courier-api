import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { credentialsEnvSchema, runtimeSchema } from '../validations/operator.validation.js';

const seedSchema = z.object({
  defaults: runtimeSchema.default({ timeoutMs: 10000, maxRetries: 3, retryBaseMs: 300, retryMaxMs: 5000 }),
  couriers: z.record(
    z.string(),
    z.object({
      enabled: z.boolean().default(true),
      runtime: runtimeSchema.partial().default({}),
      credentialsEnv: credentialsEnvSchema.default({}),
      settings: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
});

export function parseCourierSeed(data) {
  const result = seedSchema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid courier config: ${message}`);
  }
  return result.data;
}

export function loadCourierSeed(file) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) throw new Error(`Courier config file not found: ${fullPath}`);
  return parseCourierSeed(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
}

export function buildCourierContext(operator, defaults, env) {
  const prefix = operator.code.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const read = (name) => env[name] || undefined;
  const runtime = { ...defaults };
  for (const [key, value] of Object.entries(operator.runtime ?? {})) {
    if (value !== undefined) runtime[key] = value;
  }
  return {
    code: operator.code,
    enabled: operator.enabled,
    settings: operator.settings,
    credentials: {
      username: read(operator.credentialsEnv?.username ?? `${prefix}_USERNAME`),
      password: read(operator.credentialsEnv?.password ?? `${prefix}_PASSWORD`),
    },
    runtime,
  };
}
