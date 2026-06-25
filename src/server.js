import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

// Boot worker: warm the prepared-state cache before we accept traffic. Loads the disk
// snapshot instantly when the input data is unchanged; rebuilds only when it changed
// (new/edited nights). Either way the first request is already fast.
try {
  await app.handoverService.ensureReady();
} catch (err) {
  // Don't crash the deploy on a warm-up failure — fall back to lazy build on first request.
  app.log.error(err, 'boot warm-up failed; will build prepared state on first request');
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err, 'failed to start server');
  process.exit(1);
}
