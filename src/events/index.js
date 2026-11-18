import { EventBus } from './eventBus.js';
import { registerOrderEventHandlers } from './order.events.js';

export { ORDER_EVENTS } from './order.events.js';

export function createEventBus(repositories) {
  const bus = new EventBus();
  registerOrderEventHandlers(bus, repositories);
  return bus;
}
