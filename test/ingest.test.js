import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEvents, parseNightLogs } from '../src/models/ingest.js';

test('parseEvents maps each event to a RawEntry with a shift morning', () => {
  const json = JSON.stringify({
    hotel: { id: 'lumen-sg', name: 'Lumen' },
    events: [
      { id: 'evt_1', timestamp: '2026-05-25T23:14:00+08:00', room: '204', guest: 'A', type: 'check_in', description: 'Late check-in.', status: 'resolved' },
      { id: 'evt_2', timestamp: '2026-05-26T03:10:00+08:00', room: '118', description: 'Lost keycard.', status: 'resolved' },
    ],
  });
  const { hotel, entries } = parseEvents(json);
  assert.equal(hotel.id, 'lumen-sg');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].source, 'events');
  assert.equal(entries[0].shiftMorning, '2026-05-26'); // 23:14 rolls forward
  assert.equal(entries[1].shiftMorning, '2026-05-26'); // 03:10 same morning
  assert.equal(entries[0].rawText, 'Late check-in.');
  assert.equal(entries[0].hints.room, '204');
});

test('parseNightLogs splits on ## headings and resolves the morning date', () => {
  const md = [
    '# Night logs',
    '> intro that should be ignored',
    '',
    '## Night of Wed 27 May → morning Thu 28 May (relief cover)',
    'Quiet night.',
    '- Room 112 aircon still out of order.',
    '',
    '## Night of Thu 28 May → morning Fri 29 May',
    'Another note.',
  ].join('\n');
  const entries = parseNightLogs(md, { referenceYear: 2026 });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].source, 'night-log');
  assert.equal(entries[0].shiftMorning, '2026-05-28');
  assert.equal(entries[0].sourceId, 'nightlog-2026-05-28');
  assert.ok(entries[0].rawText.includes('Room 112 aircon'));
  assert.ok(!entries[0].rawText.includes('intro that should be ignored'));
  assert.equal(entries[1].shiftMorning, '2026-05-29');
});
