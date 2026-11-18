import { CourierRegistry } from '../services/couriers/registry.js';
import { discoverCourierModules } from '../services/couriers/discover.js';

export async function loadCourierRegistry(courierModules) {
  return new CourierRegistry(courierModules ?? (await discoverCourierModules()));
}
