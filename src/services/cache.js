import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Stable short hash of the given parts. Used to key LLM extractions by their exact
 * input (model + prompt version + raw text + hints) so identical input never triggers
 * a second Gemini call — extraction is pure with respect to its input.
 */
export function hashKey(...parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' ? p : JSON.stringify(p));
  return h.digest('hex').slice(0, 16);
}

/**
 * A tiny disk-backed key/value cache. Loaded once at startup; callers `set` during a
 * run and `flush` once at the end (write-through of the whole file — fine for the
 * handful of entries per hotel-night). Survives restarts.
 *
 * @param {string} filePath
 * @param {{ logger?: any }} [opts]
 */
export async function createDiskCache(filePath, { logger } = {}) {
  let store = {};
  try {
    store = JSON.parse(await readFile(filePath, 'utf8'));
    logger?.debug({ filePath, size: Object.keys(store).length }, 'loaded extraction cache');
  } catch {
    // No cache file yet — start empty.
  }
  let dirty = false;

  return {
    has: (key) => Object.prototype.hasOwnProperty.call(store, key),
    get: (key) => store[key],
    set(key, value) {
      store[key] = value;
      dirty = true;
    },
    size: () => Object.keys(store).length,
    async flush() {
      if (!dirty) return;
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(store, null, 2));
      dirty = false;
      logger?.debug({ filePath, size: Object.keys(store).length }, 'flushed extraction cache');
    },
  };
}
