/**
 * Refresh the prepared-state cache: force a full rebuild (extract + consolidate) from the
 * current input data and write a fresh disk snapshot. Run this after the input data changes
 * (e.g. a new night-log arrives) so the next boot/request is instant.
 *
 *   npm run refresh
 *
 * Logs go to stderr; the rebuilt summary is printed to stdout.
 */
import { join } from 'node:path';
import { createGeminiClient } from '../src/services/llm.js';
import { createDiskCache } from '../src/services/cache.js';
import { createHandoverService } from '../src/services/pipeline.js';
import { config } from '../src/config.js';

const logger = (() => {
  const l = {
    debug() {},
    info: (...a) => console.error('[info]', ...a),
    warn: (...a) => console.error('[warn]', ...a),
    error: (...a) => console.error('[error]', ...a),
    child: () => l,
  };
  return l;
})();

const llm = config.disableLlm
  ? null
  : createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel, logger });
const cache = await createDiskCache(join(config.tmpDir, 'extract-cache.json'), { logger });
const service = createHandoverService({ llm, cache, logger });

const state = await service.refresh();
process.stdout.write(
  JSON.stringify(
    { builtAt: state.builtAt, availableDates: state.availableDates, facts: state.factCount },
    null,
    2,
  ) + '\n',
);
