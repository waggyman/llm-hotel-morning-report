import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/models/reconcile.js';

/** Minimal consolidated-fact factory (post-extraction, post-consolidation shape). */
function fact(o) {
  return {
    sourceId: o.sourceId ?? 'evt_x',
    sourceParent: o.sourceId ?? 'evt_x',
    source: o.source ?? 'events',
    shiftMorning: o.shiftMorning,
    occurredAt: o.occurredAt ?? null,
    room: o.room ?? null,
    guest: o.guest ?? null,
    category: o.category ?? 'other',
    title: o.title ?? 'X',
    detail: o.detail ?? 'detail',
    status: o.status ?? 'open',
    threadId: o.threadId,
    threadKey: o.threadId,
    threadLabel: o.threadLabel ?? o.title ?? 'X',
    language: 'en',
    sourceQuote: o.sourceQuote ?? 'q',
    flags: o.flags ?? [],
    grounded: true,
  };
}

function find(threads, threadId) {
  return threads.find((t) => t.threadId === threadId);
}

test('carried-over open item is "still_open" on a later morning', () => {
  const facts = [fact({ threadId: 't1', shiftMorning: '2026-05-26', status: 'open' })];
  const { threads } = reconcile(facts, '2026-05-27');
  assert.equal(find(threads, 't1').lifecycle, 'still_open');
});

test('an item resolved overnight is "newly_resolved", then dropped on later mornings', () => {
  const facts = [
    fact({ threadId: 't2', shiftMorning: '2026-05-26', status: 'open' }),
    fact({ threadId: 't2', shiftMorning: '2026-05-27', status: 'resolved' }),
  ];
  assert.equal(find(reconcile(facts, '2026-05-27').threads, 't2').lifecycle, 'newly_resolved');
  // On 05-28 it was resolved on a prior night → not re-reported.
  assert.equal(find(reconcile(facts, '2026-05-28').threads, 't2'), undefined);
});

test('an item first seen tonight is "new_tonight"', () => {
  const facts = [fact({ threadId: 't3', shiftMorning: '2026-05-27', status: 'pending' })];
  assert.equal(find(reconcile(facts, '2026-05-27').threads, 't3').lifecycle, 'new_tonight');
});

test('a future-dated thread is ignored for an earlier target morning', () => {
  const facts = [fact({ threadId: 't4', shiftMorning: '2026-05-30', status: 'open' })];
  assert.equal(reconcile(facts, '2026-05-27').threads.length, 0);
});

test('status regression (resolved then reopened) is flagged as a contradiction', () => {
  const facts = [
    fact({ threadId: 't5', shiftMorning: '2026-05-28', status: 'resolved', occurredAt: '2026-05-28T01:00' }),
    fact({ threadId: 't5', shiftMorning: '2026-05-29', status: 'pending', occurredAt: '2026-05-29T01:00' }),
  ];
  const t = find(reconcile(facts, '2026-05-29').threads, 't5');
  assert.equal(t.status, 'pending'); // latest state wins
  assert.ok(t.flags.includes('contradiction'));
});

test('nightsOpen counts distinct shift mornings in the thread', () => {
  const facts = [
    fact({ threadId: 't6', shiftMorning: '2026-05-26', status: 'open' }),
    fact({ threadId: 't6', shiftMorning: '2026-05-28', status: 'open' }),
    fact({ threadId: 't6', shiftMorning: '2026-05-30', status: 'open' }),
  ];
  assert.equal(find(reconcile(facts, '2026-05-30').threads, 't6').nightsOpen, 3);
});
