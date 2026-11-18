import { getRequestId } from './logger.js';

export function sendSuccess(res, data, status = 200) {
  res.status(status).json({ success: true, data, request_id: getRequestId() });
}
