/**
 * CLI: `npm run handover -- [YYYY-MM-DD]`
 * Prints the handover JSON for the given morning (default: latest) to stdout.
 * Logs go to stderr so stdout stays pipeable (e.g. into jq).
 */
import { join } from 'node:path';
import { createGeminiClient } from './services/llm.js';
import { createDiskCache } from './services/cache.js';
import { createHandoverService } from './services/pipeline.js';
import { config } from './config.js';

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

const date = process.argv[2];
const llm = config.disableLlm
  ? null
  : createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel, logger });
const cache = await createDiskCache(join(config.tmpDir, 'extract-cache.json'), { logger });
const service = createHandoverService({ llm, cache, logger });

const handover = await service.generate({ date });
process.stdout.write(JSON.stringify(handover, null, 2) + '\n');
