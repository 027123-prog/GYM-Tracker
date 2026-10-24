import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSetTime } from '../src/utils/date.js';

test('set times are shown as local German HH:mm with leading zeroes', () => {
  const localMorning = new Date(2026, 9, 24, 9, 7, 58);
  assert.equal(formatSetTime(localMorning.toISOString()), '09:07');
  const localEvening = new Date(2026, 9, 24, 20, 45, 0);
  assert.equal(formatSetTime(localEvening.toISOString()), '20:45');
});

test('missing, invalid or date-only saved timestamps show no guessed time', () => {
  for (const value of [undefined, null, '', ' ', 'kein-datum', '2026-10-24', '2026-10-24T99:99:00Z', 0]) {
    assert.equal(formatSetTime(value), '', String(value));
  }
});

test('an explicitly recorded local midnight remains a valid set time', () => {
  const localMidnight = new Date(2026, 9, 24, 0, 0, 0);
  assert.equal(formatSetTime(localMidnight.toISOString()), '00:00');
});
