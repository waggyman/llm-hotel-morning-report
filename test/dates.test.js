import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftMorningFor, parseHeaderMorning, isoDate } from '../src/utils/dates.js';

test('shiftMorningFor: late-night events roll to the next morning', () => {
  assert.equal(shiftMorningFor('2026-05-25T23:14:00+08:00'), '2026-05-26');
  assert.equal(shiftMorningFor('2026-05-26T00:20:00+08:00'), '2026-05-26');
  assert.equal(shiftMorningFor('2026-05-26T03:10:00+08:00'), '2026-05-26');
});

test('shiftMorningFor: noon is the split boundary', () => {
  assert.equal(shiftMorningFor('2026-05-26T12:00:00+08:00'), '2026-05-27');
  assert.equal(shiftMorningFor('2026-05-26T11:59:00+08:00'), '2026-05-26');
});

test('shiftMorningFor: month/year rollover', () => {
  assert.equal(shiftMorningFor('2026-05-31T23:30:00+08:00'), '2026-06-01');
  assert.equal(shiftMorningFor('2026-12-31T23:30:00+08:00'), '2027-01-01');
});

test('shiftMorningFor: unparseable input is null', () => {
  assert.equal(shiftMorningFor('not a date'), null);
  assert.equal(shiftMorningFor(undefined), null);
});

test('parseHeaderMorning: anchors on the morning date', () => {
  assert.equal(
    parseHeaderMorning('Night of Wed 27 May → morning Thu 28 May (relief cover)', 2026),
    '2026-05-28',
  );
});

test('parseHeaderMorning: falls back to first date when no morning marker', () => {
  assert.equal(parseHeaderMorning('Night of 27 May', 2026), '2026-05-27');
});

test('parseHeaderMorning: unknown month is null', () => {
  assert.equal(parseHeaderMorning('morning 28 Foo', 2026), null);
});

test('isoDate zero-pads', () => {
  assert.equal(isoDate(2026, 0, 5), '2026-01-05');
});
