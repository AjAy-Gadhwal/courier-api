import { z } from 'zod';

const schema = z.object({
  baseUrl: z.string().url(),
  customerCode: z.string().min(1),
  serviceType: z.string().default('SDD'),
  authPath: z.string().default('/api/v1/auth/getToken/'),
  createPath: z.string().default('/api/v1/services/manifest/'),
  trackPath: z.string().default('/api/v1/services/tracking-pub/'),
  cancelPath: z.string().default('/api/v1/services/cancel/'),
  authUserField: z.string().default('username'),
  authScheme: z.string().default('Bearer'),
  tokenTtlSeconds: z.number().int().positive().default(3000),
  username: z.string().min(1, 'set the username env var'),
  password: z.string().min(1, 'set the password env var'),
});

export function loadUrbaneBoltConfig(ctx) {
  const result = schema.safeParse({ ...ctx.settings, ...ctx.credentials });
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`UrbaneBolt is enabled but misconfigured (${message}). Check the operator settings and env credentials`);
  }
  return result.data;
}
