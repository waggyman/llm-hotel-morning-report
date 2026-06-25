import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/models/reconcile.js';
import { assembleHandover } from '../src/models/handover.js';

function fact(o) {
  return {
    sourceId: o.sourceId ?? 'evt_x', sourceParent: o.sourceId ?? 'evt_x',
    source: 'events', shiftMorning: o.shiftMorning, occurredAt: o.occurredAt ?? null,
    room: o.room ?? null, guest: null, category: o.category ?? 'other',
    title: o.title ?? 'X', detail: o.detail ?? 'detail', status: o.status ?? 'open',
    threadId: o.threadId, threadKey: o.threadId, threadLabel: o.title ?? 'X',
    language: 'en', sourceQuote: o.sourceQuote ?? 'q', flags: o.flags ?? [], grounded: true,
  };
}

function assemble(facts, date) {
  return assembleHandover({ id: 'lumen-sg' }, reconcile(facts, date));
}

test('resolved items land in FYI, not on-fire', () => {
  const h = assemble([fact({ threadId: 'r', shiftMorning: '2026-05-30', status: 'resolved', category: 'complaint' })], '2026-05-30');
  assert.equal(h.sections.onFire.length, 0);
  assert.equal(h.sections.fyi.length, 1);
  assert.equal(h.sections.fyi[0].severity, 'low');
});

test('a disputed finance item carried across nights is on-fire and critical', () => {
  const facts = [
    fact({ threadId: 'd', shiftMorning: '2026-05-27', status: 'open', category: 'finance', title: 'No-show', detail: 'no-show charge not yet charged' }),
    fact({ threadId: 'd', shiftMorning: '2026-05-28', status: 'resolved', category: 'finance', detail: 'charged one night per booking terms' }),
    fact({ threadId: 'd', shiftMorning: '2026-05-29', status: 'pending', category: 'finance', detail: 'guest disputes the charge' }),
  ];
  const h = assemble(facts, '2026-05-29');
  const item = h.sections.onFire.find((i) => i.threadId === 'd');
  assert.ok(item, 'disputed finance item should be on fire');
  assert.equal(item.severity, 'critical');
  assert.ok(item.flags.includes('contradiction'));
});

test('contradictions and injections surface in reviewFlags', () => {
  const facts = [
    fact({ threadId: 'inj', shiftMorning: '2026-05-30', status: 'pending', category: 'admin', title: 'Guest note', flags: ['possible_injection'] }),
  ];
  const h = assemble(facts, '2026-05-30');
  assert.ok(h.reviewFlags.some((r) => r.flag === 'possible_injection'));
});

test('a routine single-night open item is pending, not on-fire', () => {
  const h = assemble([fact({ threadId: 'm', shiftMorning: '2026-05-30', status: 'open', category: 'maintenance', title: 'Aircon' })], '2026-05-30');
  assert.equal(h.sections.pending.length, 1);
  assert.equal(h.sections.onFire.length, 0);
});

test('every item carries a grounded timeline with quotes', () => {
  const h = assemble([fact({ threadId: 'g', shiftMorning: '2026-05-30', status: 'open', sourceQuote: 'the actual source text' })], '2026-05-30');
  const all = [...h.sections.onFire, ...h.sections.pending, ...h.sections.fyi];
  for (const item of all) {
    assert.ok(item.timeline.length >= 1);
    for (const t of item.timeline) assert.ok(typeof t.quote === 'string' && t.quote.length > 0);
  }
});
