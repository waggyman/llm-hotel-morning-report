import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err, 'failed to start server');
  process.exit(1);
}
