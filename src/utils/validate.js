import { ValidationError } from './errors.js';

export function parseWith(schema, data, prefix = '') {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new ValidationError(
    result.error.issues.map((issue) => ({
      field: [prefix, issue.path.join('.')].filter(Boolean).join('.') || undefined,
      message: issue.message,
      code: issue.code,
    })),
  );
}
