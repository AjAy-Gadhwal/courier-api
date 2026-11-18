import { sendSuccess } from '../utils/response.js';
import { operatorView } from '../utils/serializers.js';

export function createOperatorController({ operatorService }) {
  return {
    async list(_req, res) {
      const operators = await operatorService.list();
      sendSuccess(res, { operators: operators.map(operatorView) });
    },

    async getOne(req, res) {
      sendSuccess(res, operatorView(await operatorService.get(req.params.code)));
    },

    async update(req, res) {
      sendSuccess(res, operatorView(await operatorService.update(req.params.code, req.valid.body)));
    },
  };
}
