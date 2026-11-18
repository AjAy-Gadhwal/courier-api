import 'dotenv/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';

export const requestStore = new AsyncLocalStorage();

export const getRequestId = () => requestStore.getStore()?.requestId;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  mixin() {
    const store = requestStore.getStore();
    if (!store) return {};
    return { request_id: store.requestId, ...(store.batchId ? { batch_id: store.batchId } : {}) };
  },
  serializers: { err: pino.stdSerializers.err },
});
