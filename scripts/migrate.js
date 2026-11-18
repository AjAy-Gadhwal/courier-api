import { loadConfig } from '../src/config/index.js';
import { createSequelize } from '../src/config/database.js';
import { initModels } from '../src/models/index.js';

const sequelize = createSequelize(loadConfig().db);
initModels(sequelize);

try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('database tables are in sync');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
