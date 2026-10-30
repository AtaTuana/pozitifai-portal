import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderAgents,
  rankAgents,
  metricValue,
  initials,
} from '../frontend/src/features/performance/presentation.ts';

const row = (id, name, score) => ({ id, name, metrics: { averageQualityScore: score } });
const rows = [
  row('B', 'Özgür', 80),
  row('Z', 'Zeynep', null),
  row('A', 'İpek', 80),
  row('C', 'Şule', 0),
];
test('zero is a measurement; missing scores stay last in either direction', () => {
  assert.deepEqual(
    orderAgents(rows, 'averageQualityScore', false).map((item) => item.id),
    ['A', 'B', 'C', 'Z'],
  );
  assert.deepEqual(
    orderAgents(rows, 'averageQualityScore', true).map((item) => item.id),
    ['C', 'A', 'B', 'Z'],
  );
  assert.equal(metricValue(null, 'averageQualityScore'), '—');
  assert.equal(metricValue(0, 'averageQualityScore'), '0 / 100');
});
test('ties share rank, names follow Turkish collation, IDs disambiguate', () => {
  assert.deepEqual(
    [...rankAgents(rows, 'averageQualityScore', false)],
    [
      ['A', 1],
      ['B', 1],
      ['C', 3],
      ['Z', null],
    ],
  );
  assert.deepEqual(
    orderAgents([row('B', 'Işıl', 1), row('A', 'İpek', 1), row('C', 'Işıl', 1)], 'name', true).map(
      (item) => item.id,
    ),
    ['B', 'C', 'A'],
  );
  assert.equal(initials('ipek ışık'), 'İI');
});
