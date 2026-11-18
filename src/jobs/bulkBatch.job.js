import { toAppError } from '../utils/errors.js';
import { logger, requestStore } from '../utils/logger.js';
import { runPool } from '../utils/sleep.js';

export class BulkBatchJob {
  constructor({ orderService, bulkBatchRepository, concurrency }) {
    this.orderService = orderService;
    this.batches = bulkBatchRepository;
    this.concurrency = concurrency;
    this.running = new Set();
  }

  schedule(batchId, requestId) {
    const job = new Promise((resolve) => setImmediate(resolve))
      .then(() => this.process(batchId, requestId))
      .catch((err) => logger.error({ batch_id: batchId, err }, 'bulk batch processing crashed'))
      .finally(() => this.running.delete(job));
    this.running.add(job);
  }

  async resumeOpenBatches() {
    const ids = await this.batches.openBatchIds();
    ids.forEach((id) => this.schedule(id, id));
    return ids.length;
  }

  async drain() {
    while (this.running.size) await Promise.allSettled([...this.running]);
  }

  process(batchId, requestId) {
    return requestStore.run({ requestId, batchId }, async () => {
      const pending = await this.batches.pendingItems(batchId);

      await runPool(pending, this.concurrency, async (item) => {
        try {
          await this.orderService.createOrder(item.payload);
          await this.batches.markItem(batchId, item.idx, 'SUCCEEDED');
        } catch (cause) {
          const error = toAppError(cause);
          await this.batches.markItem(batchId, item.idx, 'FAILED', {
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }
      });

      await this.batches.finalizeIfDone(batchId);
      logger.info({ batch_id: batchId }, 'bulk batch finished');
    });
  }
}
