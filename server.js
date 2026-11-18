import { createApp } from './src/app.js';
import { loadConfig } from './src/config/index.js';
import { loadCourierSeed } from './src/config/courierSeed.js';
import { runStartupRecovery } from './src/jobs/index.js';
import { bootstrap } from './src/loaders/index.js';
import { logger } from './src/utils/logger.js';

async function main() {
  const config = loadConfig();
  const container = await bootstrap({ config, courierSeed: loadCourierSeed(config.courierConfigPath) });
  await runStartupRecovery(container);

  const server = createApp({ config, controllers: container.controllers }).listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'listening');
  });

  const shutdown = (signal) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await container.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
