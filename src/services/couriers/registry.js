import { AppError } from '../../utils/errors.js';

export class CourierRegistry {
  constructor(modules) {
    this.modules = new Map(modules.map((m) => [m.code.toLowerCase(), m]));
    this.adapters = new Map();
  }

  moduleFor(code) {
    return this.modules.get(code.toLowerCase());
  }

  installed() {
    return [...this.modules.keys()].sort();
  }

  activate(code, adapter) {
    this.adapters.set(code.toLowerCase(), adapter);
  }

  deactivate(code) {
    this.adapters.delete(code.toLowerCase());
  }

  supported() {
    return [...this.adapters.keys()].sort();
  }

  resolve(code) {
    const adapter = this.adapters.get(code.toLowerCase());
    if (!adapter) {
      throw new AppError('UNKNOWN_COURIER', `Unsupported courier_partner '${code}'`, {
        field: 'courier_partner',
        supported_couriers: this.supported(),
      });
    }
    return adapter;
  }
}
