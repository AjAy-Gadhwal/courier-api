import { loadCourierSeed } from '../src/config/courierSeed.js';
import { loadConfig } from '../src/config/index.js';
import { createSequelize } from '../src/config/database.js';
import { initModels } from '../src/models/index.js';
import { CourierOperatorRepository } from '../src/repositories/courierOperator.repository.js';

const config = loadConfig();
const sequelize = createSequelize(config.db);
const models = initModels(sequelize);

try {
  await sequelize.sync();
  const created = await new CourierOperatorRepository(models).seedMissing(loadCourierSeed(config.courierConfigPath));
  console.log(created.length ? `seeded operators: ${created.join(', ')}` : 'operators already seeded');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
