import { performance } from 'node:perf_hooks';
import { reconcile } from '../models/reconcile.js';
import { assembleHandover } from '../models/handover.js';
import { buildState, loadSnapshot, saveSnapshot, currentInputHash } from './state.js';

/**
 * Application service for handovers.
 *
 * The expensive pipeline (extract + consolidate) is run once into a cached prepared state
 * (see state.js). `generate({date})` then does only pure, sub-millisecond reconcile +
 * assemble, so swapping between mornings is instant.
 *
 * Lifecycle:
 *   - ensureReady(): make sure prepared state is in memory. Loads the disk snapshot if its
 *     content hash matches the current inputs; otherwise rebuilds. This is the boot worker.
 *   - refresh(): force a rebuild (use after the input data changes).
 *   - generate({date}): pure per-request work over the prepared state.
 *
 * @param {{ llm: object|null, cache: object, logger: object }} deps
 */
export function createHandoverService({ llm, cache, logger }) {
  let state = null;
  let building = null; // in-flight build promise, so concurrent callers share one build

  async function build() {
    const s = await buildState({ llm, cache, logger });
    await saveSnapshot(s);
    return s;
  }

  async function ensureReady({ force = false } = {}) {
    if (state && !force) return state;
    if (building) return building; // coalesce concurrent first-hits

    building = (async () => {
      if (!force) {
        const snap = await loadSnapshot();
        if (snap) {
          const hash = await currentInputHash();
          if (snap.dataHash === hash) {
            logger.info(
              { builtAt: snap.builtAt, availableDates: snap.availableDates, source: 'snapshot' },
              'prepared state loaded from snapshot',
            );
            state = snap;
            return state;
          }
          logger.info({ was: snap.dataHash, now: hash }, 'inputs changed since snapshot — rebuilding');
        }
      }
      state = await build();
      return state;
    })();

    try {
      return await building;
    } finally {
      building = null;
    }
  }

  return {
    ensureReady,

    /** Force a rebuild regardless of the snapshot (e.g. after data changes). */
    async refresh() {
      logger.info('refreshing prepared state (forced rebuild)');
      return ensureReady({ force: true });
    },

    /** Lightweight readiness/status for diagnostics. */
    status() {
      return state
        ? { ready: true, builtAt: state.builtAt, availableDates: state.availableDates, facts: state.factCount }
        : { ready: false };
    },

    /**
     * @param {{ date?: string }} [opts]
     */
    async generate({ date } = {}) {
      const s = await ensureReady();
      const t0 = performance.now();

      const target = date || s.availableDates[s.availableDates.length - 1];
      if (date && !s.availableDates.includes(date)) {
        logger.warn({ date, available: s.availableDates }, 'requested date has no shift in the data');
      }

      const reconciled = reconcile(s.facts, target);
      const handover = assembleHandover(s.hotel, reconciled);
      handover.availableDates = s.availableDates;

      logger.info(
        { hotelId: s.hotel.id, night: target, renderMs: Math.round(performance.now() - t0), ...handover.counts },
        'handover generated',
      );
      return handover;
    },
  };
}
