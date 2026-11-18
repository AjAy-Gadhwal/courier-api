import { createSequelize } from '../config/database.js';
import { initModels } from '../models/index.js';

export async function loadDatabase(dbConfig) {
  const sequelize = createSequelize(dbConfig);
  const models = initModels(sequelize);
  await sequelize.authenticate();
  if (dbConfig.autoSync) await sequelize.sync();
  return { sequelize, models };
}
