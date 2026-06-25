import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from '../config.js';
import { hashKey } from './cache.js';
import { readRawInputs, parseInputs } from './dataSource.js';
import { extractAll } from '../models/extract.js';
import { consolidateThreads, shiftMornings } from '../models/reconcile.js';

/**
 * Prepared-state layer. The expensive work (LLM extraction + thread consolidation) depends
 * ONLY on the input data, not on which morning is requested. So we compute it once into a
 * "prepared state" — consolidated facts + the list of available mornings + a content hash
 * of the inputs — and cache it both in memory (instant reads) and on disk (instant boot
 * across restarts). Per-request work is then just pure reconcile + assemble.
 *
 * No external cache (memcached/Redis) is used: the data is tiny and single-process, and a
 * disk snapshot survives restarts better than an external cache would. The snapshot is
 * behind this module's small surface, so swapping in another store later is localized.
 *
 * @typedef {Object} PreparedState
 * @property {string} dataHash       hash of the raw input text; identifies this dataset
 * @property {Object} hotel
 * @property {object[]} facts        consolidated, grounded facts
 * @property {string[]} availableDates  shift-mornings present, ascending
 * @property {string} builtAt        ISO timestamp
 * @property {number} factCount
 */

const SNAPSHOT_PATH = join(config.tmpDir, 'handover-state.json');
const STATE_VERSION = 'state-v1'; // bump to invalidate all snapshots on shape changes

/** Content hash of the raw inputs — the cache key for a prepared state. */
export function hashInputs({ eventsText, logsText }) {
  return hashKey(STATE_VERSION, eventsText, logsText ?? '');
}

/** Hash of the current on-disk inputs (used by the boot worker to detect changes). */
export async function currentInputHash(dir) {
  return hashInputs(await readRawInputs(dir));
}

/**
 * Build a prepared state from raw inputs (defaults to the on-disk data dir).
 * Runs ingest -> extract (LLM, per-entry cached) -> consolidate threads (LLM).
 */
export async function buildState({ inputs, llm, cache, logger } = {}) {
  const t0 = performance.now();
  const raw = inputs ?? await readRawInputs();
  const dataHash = hashInputs(raw);
  const { hotel, entries } = parseInputs(raw);

  const extracted = await extractAll(entries, { llm, cache, logger });
  const facts = await consolidateThreads(extracted, { llm, logger });
  const availableDates = shiftMornings(facts);

  logger?.info(
    {
      hotelId: hotel.id,
      dataHash,
      facts: facts.length,
      ungrounded: facts.filter((f) => !f.grounded).length,
      availableDates,
      buildMs: Math.round(performance.now() - t0),
    },
    'prepared state built',
  );

  return {
    dataHash,
    hotel,
    facts,
    availableDates,
    builtAt: new Date().toISOString(),
    factCount: facts.length,
  };
}

export async function loadSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export async function saveSnapshot(state) {
  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(state));
}

export const snapshotPath = SNAPSHOT_PATH;
