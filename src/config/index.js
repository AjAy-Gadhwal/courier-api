import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY: z.string().optional(),
  COURIER_CONFIG_PATH: z.string().default('./src/config/couriers.json'),
  BULK_MAX_SIZE: z.coerce.number().int().positive().default(100),
  BULK_CONCURRENCY: z.coerce.number().int().positive().default(10),
  DB_DIALECT: z.enum(['mysql', 'sqlite']).default('mysql'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('courier_platform'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_LOGGING: bool.default(false),
  DB_AUTO_SYNC: bool.default(true),
  DB_SQLITE_PATH: z.string().default(':memory:'),
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    apiKey: e.API_KEY || undefined,
    courierConfigPath: e.COURIER_CONFIG_PATH,
    bulkMaxSize: e.BULK_MAX_SIZE,
    bulkConcurrency: e.BULK_CONCURRENCY,
    db: {
      dialect: e.DB_DIALECT,
      host: e.DB_HOST,
      port: e.DB_PORT,
      name: e.DB_NAME,
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      poolMax: e.DB_POOL_MAX,
      logging: e.DB_LOGGING,
      autoSync: e.DB_AUTO_SYNC,
      sqlitePath: e.DB_SQLITE_PATH,
    },
    rawEnv: env,
  };
}
