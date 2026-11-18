import { buildCourierContext } from '../config/courierSeed.js';
import { AppError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class OperatorService {
  constructor({ registry, courierOperatorRepository, defaults, env }) {
    this.registry = registry;
    this.operators = courierOperatorRepository;
    this.defaults = defaults;
    this.env = env;
  }

  async init(seed) {
    for (const code of await this.operators.seedMissing(seed)) {
      logger.info({ courier: code }, 'operator seeded from config file');
    }

    for (const operator of await this.operators.list()) {
      if (!this.registry.moduleFor(operator.code)) {
        logger.warn({ courier: operator.code }, 'operator has settings but no adapter is installed, skipping');
        continue;
      }
      const adapter = this.buildAdapter(operator);
      if (adapter) this.registry.activate(operator.code, adapter);
      else logger.info({ courier: operator.code }, 'operator inactive (disabled or no credentials)');
    }
  }

  async list() {
    const active = new Set(this.registry.supported());
    const operators = await this.operators.list();
    return operators.map((operator) => this.decorate(operator, active));
  }

  async get(code) {
    const operator = await this.operators.find(code.toLowerCase());
    if (!operator) throw new AppError('OPERATOR_NOT_FOUND', `Operator '${code}' not found`);
    return this.decorate(operator, new Set(this.registry.supported()));
  }

  async update(rawCode, patch) {
    const code = rawCode.toLowerCase();
    if (!this.registry.moduleFor(code)) {
      throw new AppError('UNKNOWN_COURIER', `No adapter installed for '${code}'`, {
        field: 'code',
        installed_adapters: this.registry.installed(),
      });
    }

    const current = await this.operators.find(code);
    const next = {
      code,
      enabled: patch.enabled ?? current?.enabled ?? true,
      settings: { ...current?.settings, ...patch.settings },
      runtime: { ...current?.runtime, ...patch.runtime },
      credentialsEnv: { ...current?.credentialsEnv, ...patch.credentials_env },
    };

    let adapter;
    try {
      adapter = this.buildAdapter(next);
    } catch (error) {
      throw new ValidationError([{ field: 'settings', message: error.message }]);
    }

    const saved = await this.operators.save(next);
    if (adapter) this.registry.activate(code, adapter);
    else this.registry.deactivate(code);
    logger.info({ courier: code, active: Boolean(adapter) }, 'operator updated');
    return this.decorate(saved, new Set(this.registry.supported()));
  }

  buildAdapter(operator) {
    const courierModule = this.registry.moduleFor(operator.code);
    if (!courierModule || !operator.enabled) return null;
    const ctx = buildCourierContext(operator, this.defaults, this.env);
    return courierModule.enabled(ctx) ? courierModule.create(ctx) : null;
  }

  decorate(operator, active) {
    const courierModule = this.registry.moduleFor(operator.code);
    return { ...operator, displayName: courierModule?.displayName ?? operator.code, active: active.has(operator.code) };
  }
}
