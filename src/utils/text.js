/**
 * Generic text helpers. Pure, no domain knowledge.
 */

/** Normalize for forgiving substring comparison: NFC unicode, collapsed whitespace, lowercased. */
export function normalizeText(s) {
  return (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Turn arbitrary text into a slug of [a-z0-9-]. Non-latin scripts (e.g. Chinese) reduce
 * to empty — callers should fall back to a stable id in that case.
 * @param {string} text
 * @param {{ maxLen?: number }} [opts] maxLen 0 = no limit
 */
export function slugify(text, { maxLen = 60 } = {}) {
  const base = (text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return maxLen ? base.slice(0, maxLen) : base;
}
