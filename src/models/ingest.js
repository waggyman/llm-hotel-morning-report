/**
 * Ingest layer — PURE parsing of the two input formats into a common `RawEntry`
 * shape that the extractor consumes. No file I/O lives here (see
 * services/dataSource.js) so these functions stay trivially testable and
 * generalize to input that arrives over the wire rather than from disk.
 *
 * @typedef {Object} RawEntry
 * @property {string}  sourceId   Stable reference, e.g. "evt_0002" or "nightlog-2026-05-28".
 * @property {"events"|"night-log"} source
 * @property {string}  rawText    The text a statement must be grounded against.
 * @property {string|null} shiftMorning  ISO date (YYYY-MM-DD) of the morning this entry
 *                                        belongs to, when known deterministically.
 * @property {Object|null} hints  Structured fields already present in the source (events
 *                                only). Hints are *inputs* to extraction, never trusted as
 *                                output — the LLM still re-derives and code still grounds.
 * @property {string|null} context  Optional surrounding context (e.g. a night-log header).
 */

import { shiftMorningFor, parseHeaderMorning } from '../utils/dates.js';
import { slugify } from '../utils/text.js';

/**
 * Parse events.json text into the hotel record and one RawEntry per event.
 * @param {string} jsonText
 * @returns {{ hotel: Object, entries: RawEntry[] }}
 */
export function parseEvents(jsonText) {
  const doc = JSON.parse(jsonText);
  const events = Array.isArray(doc.events) ? doc.events : [];
  const entries = events.map((e) => ({
    sourceId: e.id,
    source: 'events',
    rawText: e.description ?? '',
    shiftMorning: e.timestamp ? shiftMorningFor(e.timestamp) : null,
    hints: {
      timestamp: e.timestamp ?? null,
      type: e.type ?? null,
      room: e.room ?? null,
      guest: e.guest ?? null,
      status: e.status ?? null,
    },
    context: null,
  }));
  return { hotel: doc.hotel ?? {}, entries };
}

/**
 * Parse night-logs.md into one section per `##` heading. Each section's full prose
 * is kept intact — segmentation into discrete facts is the extractor's job (the LLM
 * reads arbitrary, possibly non-English prose), and every fact it returns is later
 * grounded against this `rawText`. Content before the first `##` is treated as
 * file-level intro and ignored.
 *
 * @param {string} mdText
 * @param {{ referenceYear: number }} opts
 * @returns {RawEntry[]} one entry per night section (source: "night-log")
 */
export function parseNightLogs(mdText, { referenceYear }) {
  const lines = mdText.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { header: heading[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => {
    const morning = parseHeaderMorning(s.header, referenceYear);
    return {
      sourceId: morning ? `nightlog-${morning}` : `nightlog-${slugify(s.header, { maxLen: 40 })}`,
      source: 'night-log',
      rawText: s.body.join('\n').trim(),
      shiftMorning: morning,
      hints: null,
      context: s.header,
    };
  });
}
