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

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Format a Date's calendar day as YYYY-MM-DD (no timezone math; values are already local). */
function isoDate(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Map an event timestamp to the morning its shift hands over to.
 * A night shift runs ~23:00–07:00 and spans two dates, so we split at local noon:
 * anything from noon onward belongs to the *next* morning; anything before noon
 * (the small hours) belongs to the *same* morning.
 *
 * Works off the ISO string's own offset so we don't depend on the host timezone.
 * @param {string} timestamp ISO-8601 with offset, e.g. "2026-05-25T23:14:00+08:00".
 * @returns {string|null} YYYY-MM-DD or null if unparseable.
 */
export function shiftMorningFor(timestamp) {
  const m = String(timestamp).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h] = m.map(Number);
  if (Number(h) >= 12) {
    // Roll to the next calendar day using a UTC Date purely for date arithmetic.
    const next = new Date(Date.UTC(y, mo - 1, d + 1));
    return isoDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  }
  return isoDate(y, mo - 1, d);
}

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
 * Parse a night-log header like "Night of Wed 27 May → morning Thu 28 May (...)".
 * We anchor on the *morning* date because that's the handover morning the entries
 * belong to. Falls back to the first date found if no explicit "morning" marker.
 * @returns {string|null} YYYY-MM-DD
 */
export function parseHeaderMorning(headerText, referenceYear) {
  const afterMorning = headerText.split(/morning/i)[1] ?? headerText;
  const m = afterMorning.match(/(\d{1,2})\s+([A-Za-z]{3,})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  return isoDate(referenceYear, month, day);
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
      sourceId: morning ? `nightlog-${morning}` : `nightlog-${slug(s.header)}`,
      source: 'night-log',
      rawText: s.body.join('\n').trim(),
      shiftMorning: morning,
      hints: null,
      context: s.header,
    };
  });
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}
