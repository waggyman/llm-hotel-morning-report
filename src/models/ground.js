/**
 * Grounding — the safety net. Every fact the extractor emits must carry a
 * `sourceQuote` copied verbatim from its source text. Here we verify that claim in
 * plain code: if the quote isn't actually present in the source, the fact is flagged
 * `unverified` and downstream assembly refuses to present it as established truth.
 *
 * This is what stops a model hallucination from reaching the morning manager: a made-up
 * statement cannot produce a quote that exists in the source.
 */

/** Normalize for substring comparison: NFC unicode, collapsed whitespace, lowercased. */
function normalize(s) {
  return (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * @param {object} fact   must have .sourceQuote and .flags[]
 * @param {string} rawText source text the quote must appear in
 * @returns {object} fact with { grounded: boolean, flags } updated
 */
export function groundFact(fact, rawText) {
  const hay = normalize(rawText);
  const needle = normalize(fact.sourceQuote);
  const grounded = needle.length > 0 && hay.includes(needle);
  const flags = new Set(fact.flags ?? []);
  if (!grounded) flags.add('unverified');
  return { ...fact, grounded, flags: [...flags] };
}

/**
 * Ground a list of facts against one source text, logging each rejection with enough
 * context to debug a bad handover: which source entry, which unverifiable quote.
 */
export function groundFacts(facts, rawText, { logger, sourceId } = {}) {
  return facts.map((f) => {
    const g = groundFact(f, rawText);
    if (!g.grounded) {
      logger?.warn(
        { sourceId, quote: f.sourceQuote, title: f.title },
        'grounding rejected fact: sourceQuote not found verbatim in source',
      );
    }
    return g;
  });
}
