import { Sequelize } from 'sequelize';

export function createSequelize(db) {
  const logging = db.logging ? console.log : false;

  if (db.dialect === 'sqlite') {
    return new Sequelize({ dialect: 'sqlite', storage: db.sqlitePath, logging, pool: { max: 1, min: 1 } });
  }

  return new Sequelize(db.name, db.user, db.password, {
    host: db.host,
    port: db.port,
    dialect: 'mysql',
    logging,
    timezone: '+00:00',
    pool: { max: db.poolMax, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  });
}
