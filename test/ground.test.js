import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundFact } from '../src/models/ground.js';

test('grounded when the quote appears verbatim in the source', () => {
  const g = groundFact(
    { sourceQuote: 'Aircon not cooling', flags: [] },
    'Aircon not cooling. Guest moved to room 115.',
  );
  assert.equal(g.grounded, true);
  assert.ok(!g.flags.includes('unverified'));
});

test('grounding is tolerant of case and whitespace differences', () => {
  const g = groundFact(
    { sourceQuote: 'aircon   NOT  cooling', flags: [] },
    'Aircon not cooling. Guest moved.',
  );
  assert.equal(g.grounded, true);
});

test('matches a non-English quote verbatim', () => {
  const g = groundFact(
    { sourceQuote: '保险箱打不开了', flags: ['non_english'] },
    '208 房的客人刚才下来说房间的保险箱打不开了，他的护照和现金锁在里面。',
  );
  assert.equal(g.grounded, true);
});

test('ungrounded quote is flagged unverified, never silently kept', () => {
  const g = groundFact(
    { sourceQuote: 'the compressor exploded', flags: [] },
    'Aircon not cooling. Guest moved.',
  );
  assert.equal(g.grounded, false);
  assert.ok(g.flags.includes('unverified'));
});

test('empty quote cannot be grounded', () => {
  const g = groundFact({ sourceQuote: '', flags: [] }, 'anything');
  assert.equal(g.grounded, false);
});
