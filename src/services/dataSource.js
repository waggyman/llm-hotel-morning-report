import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { parseEvents, parseNightLogs } from '../models/ingest.js';

/**
 * Read the raw input text from disk. This is the only place that touches the filesystem
 * for sample data; the models stay pure. Swap this out to ingest input arriving over HTTP.
 *
 * @param {string} [dir] data directory (defaults to config.dataDir)
 * @returns {Promise<{ eventsText: string, logsText: string }>}
 */
export async function readRawInputs(dir = config.dataDir) {
  const [eventsText, logsText] = await Promise.all([
    readFile(join(dir, 'events.json'), 'utf8'),
    readFile(join(dir, 'night-logs.md'), 'utf8'),
  ]);
  return { eventsText, logsText };
}

/**
 * Read and parse the raw inputs into a single ingest result.
 * @param {string} [dir] data directory (defaults to config.dataDir)
 * @returns {Promise<{ hotel: Object, entries: import('../models/ingest.js').RawEntry[] }>}
 */
export async function loadFromDir(dir = config.dataDir) {
  return parseInputs(await readRawInputs(dir));
}

/**
 * Parse already-loaded text inputs (the form input takes when it arrives as data,
 * not a file). Year for the free-text log is inferred from the structured events so
 * the relief-staff prose ("morning Thu 28 May") resolves to a full date.
 *
 * @param {{ eventsText: string, logsText?: string }} inputs
 */
export function parseInputs({ eventsText, logsText }) {
  const { hotel, entries: eventEntries } = parseEvents(eventsText);
  const referenceYear = inferYear(eventEntries);
  const logEntries = logsText
    ? parseNightLogs(logsText, { referenceYear })
    : [];
  return { hotel, entries: [...eventEntries, ...logEntries] };
}

function inferYear(eventEntries) {
  for (const e of eventEntries) {
    const ts = e.hints?.timestamp;
    const m = ts && String(ts).match(/^(\d{4})/);
    if (m) return Number(m[1]);
  }
  return new Date().getUTCFullYear();
}
