import { sendSuccess } from '../utils/response.js';

export function createCourierController({ orderService }) {
  return {
    list(_req, res) {
      sendSuccess(res, { supported_couriers: orderService.supportedCouriers() });
    },
  };
}
