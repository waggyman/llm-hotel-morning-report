import { join } from 'node:path';
import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import { config } from './config.js';
import { createGeminiClient } from './services/llm.js';
import { createDiskCache } from './services/cache.js';
import { createHandoverService } from './services/pipeline.js';
import { handoverRoutes } from './controllers/handoverController.js';

/**
 * Build the Fastify app: structured (pino) logging, EJS views, the handover pipeline
 * service wired from config, and the routes. Returns a ready-to-listen instance.
 */
export async function buildApp(overrides = {}) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Pretty logs in dev; plain JSON (production-shaped, log-aggregator-friendly) otherwise.
      ...(process.env.NODE_ENV !== 'production'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
        : {}),
    },
  });

  await app.register(fastifyView, {
    engine: { ejs },
    root: join(config.projectRoot, 'src', 'views'),
  });

  // Wire the pipeline service. LLM is optional: with no key / DISABLE_LLM the pipeline
  // falls back to deterministic extraction so the service still responds.
  const llm = overrides.llm
    ?? (config.disableLlm
      ? null
      : createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel, logger: app.log }));
  if (config.disableLlm) app.log.warn('LLM disabled — using deterministic fallback extractor');

  const cache = overrides.cache
    ?? await createDiskCache(join(config.tmpDir, 'extract-cache.json'), { logger: app.log });

  const handoverService = overrides.handoverService
    ?? createHandoverService({ llm, cache, logger: app.log });

  app.decorate('handoverService', handoverService);
  await app.register(handoverRoutes);

  return app;
}
