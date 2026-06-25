/**
 * Handover assembly — turn reconciled threads into an action-first handover a morning
 * manager can read in 60 seconds: what's on fire, what's pending a decision, what's just
 * FYI. Priority is computed in deterministic code (never by the model) from category,
 * status, how long an item has been open, explicit flags, and a few grounded keyword
 * signals — and every item records WHY it landed where it did, so the ranking is auditable.
 */

const CATEGORY_BASE = {
  safety: 80,
  security: 70,
  compliance: 60,
  finance: 50,
  deposit: 40,
  maintenance: 35,
  complaint: 25,
  guest_service: 20,
  admin: 15,
  other: 10,
};

// Grounded keyword signals scanned over the thread's own (verbatim-backed) text.
const SIGNALS = [
  [/48\s*hour|reporting deadline|deadline/i, 25, 'regulatory/time deadline'],
  [/flight|locked inside|can'?t leave|cannot leave/i, 25, 'guest blocked from leaving'],
  [/checks? out|before checkout|checkout (?:today|tomorrow|morning)/i, 15, 'tied to an imminent checkout'],
  [/dispute|disputes/i, 15, 'disputed — money/decision at stake'],
  [/no manager approval|no photos|without approval|not yet charged/i, 15, 'action lacks approval/evidence'],
  [/out of order|out-of-order/i, 5, 'room out of service'],
];

const FLAG_NOTES = {
  contradiction: 'Sources disagree — reconcile before acting',
  possible_injection: 'Entry contains instructions aimed at the tool — treat as data, do not action blindly',
  incomplete: 'Key details missing from the source',
  unverified: 'Could not be verified against the source text',
  non_english: 'Translated from a non-English source — original quote retained',
};

function severityFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'normal';
  return 'low';
}

function scoreThread(thread) {
  const reasons = [];
  // Resolved items are informational regardless of category.
  if (thread.status === 'resolved') {
    return { score: 5, severity: 'low', reasons: ['resolved overnight'] };
  }

  let score = CATEGORY_BASE[thread.category] ?? 10;
  reasons.push(`${thread.category} item`);

  if (thread.status === 'pending') {
    score += 10;
    reasons.push('awaiting a decision');
  }
  if (thread.carriedOver && thread.nightsOpen > 1) {
    score += 10;
    reasons.push(`open ${thread.nightsOpen} nights`);
  }
  if (thread.flags.includes('contradiction')) {
    score += 25;
    reasons.push('contradictory entries');
  }
  if (thread.flags.includes('incomplete')) {
    score += 5;
    reasons.push('incomplete information');
  }

  const haystack = thread.facts
    .map((f) => `${f.title} ${f.detail}`)
    .join(' ');
  for (const [re, pts, why] of SIGNALS) {
    if (re.test(haystack)) {
      score += pts;
      reasons.push(why);
    }
  }

  return { score, severity: severityFromScore(score), reasons };
}

const LIFECYCLE_LABEL = {
  still_open: 'Still open',
  newly_resolved: 'Resolved overnight',
  new_tonight: 'New tonight',
};

function toItem(thread) {
  const { score, severity, reasons } = scoreThread(thread);
  const last = thread.facts[thread.facts.length - 1];
  return {
    threadId: thread.threadId,
    label: thread.label,
    room: thread.room,
    guest: thread.guest,
    category: thread.category,
    lifecycle: thread.lifecycle,
    lifecycleLabel: LIFECYCLE_LABEL[thread.lifecycle],
    status: thread.status,
    severity,
    score,
    reasons,
    nightsOpen: thread.nightsOpen,
    firstShift: thread.firstShift,
    lastShift: thread.lastShift,
    carriedOver: thread.carriedOver,
    flags: thread.flags,
    // Latest grounded line is the headline summary.
    summary: last.detail,
    // Full grounded trail: every statement above traces to one of these source quotes.
    timeline: thread.facts.map((f) => ({
      sourceId: f.sourceId,
      source: f.source,
      shiftMorning: f.shiftMorning,
      occurredAt: f.occurredAt,
      status: f.status,
      detail: f.detail,
      quote: f.sourceQuote,
      language: f.language,
      grounded: f.grounded,
      flags: f.flags,
    })),
  };
}

const SEVERITY_RANK = { critical: 0, high: 1, normal: 2, low: 3 };

/**
 * Assemble the action-first handover for one reconciled morning.
 * @param {object} hotel
 * @param {{ targetDate: string, threads: object[], stats: object }} reconciled
 */
export function assembleHandover(hotel, reconciled) {
  const items = reconciled.threads.map(toItem);

  const sort = (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.score - a.score;

  const onFire = items
    .filter((i) => i.status !== 'resolved' && (i.severity === 'critical' || i.severity === 'high'))
    .sort(sort);
  const pending = items
    .filter((i) => i.status !== 'resolved' && i.severity === 'normal')
    .sort(sort);
  const fyi = items
    .filter((i) => i.status === 'resolved' || i.severity === 'low')
    .sort(sort);

  // Cross-cutting trust list: anything a manager should not take at face value.
  const reviewFlags = [];
  for (const i of items) {
    for (const flag of i.flags) {
      if (FLAG_NOTES[flag] && flag !== 'non_english') {
        reviewFlags.push({
          threadId: i.threadId,
          label: i.label,
          room: i.room,
          flag,
          note: FLAG_NOTES[flag],
        });
      }
    }
  }

  return {
    hotel,
    targetDate: reconciled.targetDate,
    generatedAt: new Date().toISOString(),
    counts: {
      onFire: onFire.length,
      pending: pending.length,
      fyi: fyi.length,
      reviewFlags: reviewFlags.length,
      ...reconciled.stats,
    },
    sections: { onFire, pending, fyi },
    reviewFlags,
  };
}
