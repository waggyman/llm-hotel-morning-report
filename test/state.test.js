import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildState, hashInputs } from '../src/services/state.js';

const silent = { debug() {}, info() {}, warn() {}, error() {}, child: () => silent };

const inputs = {
  eventsText: JSON.stringify({
    hotel: { id: 'lumen-sg', name: 'Lumen' },
    events: [
      { id: 'evt_1', timestamp: '2026-05-25T23:14:00+08:00', room: '204', description: 'Late check-in.', status: 'resolved' },
      { id: 'evt_2', timestamp: '2026-05-26T00:20:00+08:00', room: '112', description: 'Aircon out of order.', status: 'unresolved' },
    ],
  }),
  logsText: '## Night of Wed 27 May → morning Thu 28 May\n- Room 112 aircon still broken.\n',
};

test('hashInputs is stable and content-sensitive', () => {
  const a = hashInputs(inputs);
  assert.equal(a, hashInputs({ ...inputs })); // same content -> same hash
  assert.notEqual(a, hashInputs({ ...inputs, logsText: inputs.logsText + 'x' })); // changed -> different
});

test('buildState (offline, deterministic fallback) yields consolidated state', async () => {
  // llm:null + cache:null exercises the no-LLM path — no network, fully deterministic.
  const state = await buildState({ inputs, llm: null, cache: null, logger: silent });
  assert.equal(state.hotel.id, 'lumen-sg');
  assert.ok(state.factCount >= 2);
  assert.equal(state.dataHash, hashInputs(inputs));
  // Shift mornings derived from the data, ascending.
  assert.deepEqual(state.availableDates, ['2026-05-26', '2026-05-28']);
  assert.ok(state.builtAt);
});
