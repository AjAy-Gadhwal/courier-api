import { BulkBatchJob } from './bulkBatch.job.js';

export { runStartupRecovery } from './recovery.job.js';

export function createJobs({ services, repositories, config }) {
  return {
    bulkBatch: new BulkBatchJob({
      orderService: services.order,
      bulkBatchRepository: repositories.bulkBatch,
      concurrency: config.bulkConcurrency,
    }),
  };
}
