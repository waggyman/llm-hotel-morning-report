/**
 * Generic date helpers. Pure, no domain knowledge beyond the night-shift convention
 * that a shift (~23:00–07:00) hands over to a single morning.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Format a calendar day as YYYY-MM-DD. */
export function isoDate(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Map an event timestamp to the morning its shift hands over to.
 * A night shift runs ~23:00–07:00 and spans two dates, so we split at local noon:
 * from noon onward belongs to the *next* morning; before noon (the small hours)
 * belongs to the *same* morning. Reads the ISO string's own offset, so the result is
 * independent of the host timezone.
 *
 * @param {string} timestamp ISO-8601 with offset, e.g. "2026-05-25T23:14:00+08:00".
 * @returns {string|null} YYYY-MM-DD or null if unparseable.
 */
export function shiftMorningFor(timestamp) {
  const m = String(timestamp).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h] = m.map(Number);
  if (Number(h) >= 12) {
    const next = new Date(Date.UTC(y, mo - 1, d + 1));
    return isoDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  }
  return isoDate(y, mo - 1, d);
}

/**
 * Parse a free-text night-log header like "Night of Wed 27 May → morning Thu 28 May".
 * Anchors on the *morning* date (the handover morning the entries belong to); falls
 * back to the first date found if there's no explicit "morning" marker.
 *
 * @param {string} headerText
 * @param {number} referenceYear  year to attach (the log omits it)
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
