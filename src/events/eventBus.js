import { logger } from '../utils/logger.js';

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  async emit(event, payload) {
    const list = this.handlers.get(event) ?? [];
    await Promise.all(
      list.map(async (handler) => {
        try {
          await handler(payload);
        } catch (err) {
          logger.error({ event, err }, 'event handler failed');
        }
      }),
    );
  }
}
