import { logger } from '../utils/logger.js';

export async function runStartupRecovery({ repositories, jobs }) {
  const interruptedOrders = await repositories.order.failInterrupted();
  const resumedBatches = await jobs.bulkBatch.resumeOpenBatches();
  if (interruptedOrders || resumedBatches) {
    logger.warn({ interrupted_orders: interruptedOrders, resumed_batches: resumedBatches }, 'startup recovery');
  }
  return { interruptedOrders, resumedBatches };
}
