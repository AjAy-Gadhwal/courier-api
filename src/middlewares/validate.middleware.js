import { parseWith } from '../utils/validate.js';

export function validate({ body, query } = {}) {
  return (req, _res, next) => {
    req.valid = {};
    if (body) req.valid.body = parseWith(body, req.body ?? {});
    if (query) req.valid.query = parseWith(query, req.query);
    next();
  };
}
