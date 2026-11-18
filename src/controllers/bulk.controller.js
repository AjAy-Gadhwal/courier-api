import { getRequestId } from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';
import { batchView } from '../utils/serializers.js';

export function createBulkController({ bulkService }) {
  return {
    async submit(req, res) {
      const result = await bulkService.submit(req.body, getRequestId());
      sendSuccess(
        res,
        {
          batch_id: result.batchId,
          status: 'PROCESSING',
          total: result.total,
          accepted: result.accepted,
          rejected: result.rejected,
          status_url: `/api/v1/orders/bulk/${result.batchId}`,
        },
        202,
      );
    },

    async status(req, res) {
      sendSuccess(res, batchView(await bulkService.getBatch(req.params.batchId)));
    },
  };
}
