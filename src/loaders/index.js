import { createControllers } from '../controllers/index.js';
import { createEventBus } from '../events/index.js';
import { createJobs } from '../jobs/index.js';
import { loadCourierRegistry } from './couriers.loader.js';
import { loadDatabase } from './database.loader.js';
import { loadRepositories } from './repositories.loader.js';
import { loadBulkService, loadServices } from './services.loader.js';

export async function bootstrap({ config, courierSeed, courierModules }) {
  const { sequelize, models } = await loadDatabase(config.db);
  const repositories = loadRepositories(models);
  const events = createEventBus({ trackingEventRepository: repositories.trackingEvent });
  const registry = await loadCourierRegistry(courierModules);

  const services = loadServices({ registry, repositories, events, config, courierSeed });
  const jobs = createJobs({ services, repositories, config });
  services.bulk = loadBulkService({ registry, repositories, jobs, config });

  await services.operator.init(courierSeed);

  const controllers = createControllers(services);

  return {
    config,
    sequelize,
    models,
    repositories,
    events,
    registry,
    services,
    jobs,
    controllers,
    async close() {
      await jobs.bulkBatch.drain();
      await sequelize.close();
    },
  };
}
