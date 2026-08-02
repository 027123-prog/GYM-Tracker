import assert from 'node:assert/strict';
import test from 'node:test';

import { formatKilograms } from '../src/utils/strength.js';

test('Kilogrammwerte werden auf Achse und Karten einheitlich deutsch formatiert', () => {
  assert.equal(formatKilograms(120), '120 kg');
  assert.equal(formatKilograms(107.7), '107,7 kg');
  assert.equal(formatKilograms('336.4'), '336,4 kg');
  assert.equal(formatKilograms('kein-wert'), '–');
});
