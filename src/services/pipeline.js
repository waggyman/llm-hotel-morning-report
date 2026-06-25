import { performance } from 'node:perf_hooks';
import { loadFromDir, parseInputs } from './dataSource.js';
import { extractAll } from '../models/extract.js';
import { consolidateThreads, reconcile, latestMorning, shiftMornings } from '../models/reconcile.js';
import { assembleHandover } from '../models/handover.js';

/**
 * Application service that runs the whole handover pipeline:
 *   ingest -> extract (LLM) -> ground -> consolidate threads -> reconcile -> assemble.
 *
 * It logs structured context another builder or agent can debug a bad handover from:
 * which hotel, which night, how many model calls, counts per bucket, timing.
 *
 * @param {{ llm: object|null, cache: object, logger: object }} deps
 */
export function createHandoverService({ llm, cache, logger }) {
  return {
    /**
     * @param {{ date?: string, inputs?: { eventsText: string, logsText?: string } }} [opts]
     */
    async generate({ date, inputs } = {}) {
      const t0 = performance.now();
      const { hotel, entries } = inputs ? parseInputs(inputs) : await loadFromDir();

      const reqLog = logger.child({ hotelId: hotel.id, requestedDate: date ?? 'latest' });
      reqLog.info({ entries: entries.length, llm: llm?.name ?? 'disabled' }, 'handover requested');

      const facts = await extractAll(entries, { llm, cache, logger: reqLog });
      const consolidated = await consolidateThreads(facts, { llm, logger: reqLog });

      const available = shiftMornings(facts);
      const target = date || latestMorning(facts);
      if (date && !available.includes(date)) {
        reqLog.warn({ date, available }, 'requested date has no shift in the data');
      }

      const reconciled = reconcile(consolidated, target);
      const handover = assembleHandover(hotel, reconciled);
      handover.availableDates = available;

      const durationMs = Math.round(performance.now() - t0);
      reqLog.info(
        {
          night: target,
          durationMs,
          facts: facts.length,
          ungrounded: facts.filter((f) => !f.grounded).length,
          ...handover.counts,
        },
        'handover generated',
      );
      return handover;
    },
  };
}
