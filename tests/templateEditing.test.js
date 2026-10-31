import assert from 'node:assert/strict';
import test from 'node:test';
import { updateTemplateRecord } from '../src/utils/templateEditing.js';
import { createBackupPayload, normalizeAppState, parseBackupPayload } from '../src/utils/storage.js';

function fixture() {
  return {
    exercises: [
      { id: 'row', name: 'Row Plate', weightOptions: [40, 60], settings: { loadType: 'normal', bodyweightPercent: 100, setupNotes: 'Sitz 3' } },
      { id: 'lat', name: 'Latzug', weightOptions: [50], settings: { loadType: 'normal', bodyweightPercent: 100, setupNotes: 'Polster 2' } },
      { id: 'old', name: 'Archivierte Übung', archivedAt: '2026-10-24', settings: { loadType: 'normal' } },
    ],
    templates: [
      { id: 'a', name: 'Ganzkörper A', createdAt: '2026-10-01', custom: 'erhalten', exerciseTemplates: [
        { exerciseId: 'row', name: 'Alter Name', repScheme: '2 × 8–12', customEntry: 'Griffhinweis' },
        { exerciseId: 'lat', name: 'Latzug', repScheme: '2 × 10' },
      ] },
      { id: 'b', name: 'Ganzkörper B', exerciseTemplates: [{ exerciseId: 'lat', name: 'Latzug', repScheme: '2 × 8' }] },
    ],
    workouts: [
      { id: 'completed', name: 'Ganzkörper A', date: '2026-10-01T12:00:00.000Z', completedAt: '2026-10-01T13:00:00.000Z', mode: 'template', templateId: 'a', exercises: [{ id: 'entry', exerciseId: 'row', name: 'Alter Name', targetRepScheme: '2 × 8–12', machineSettings: [{ label: 'Sitz', value: '3' }], sets: [{ id: 'set', weight: 60, reps: 10, comment: 'Gut', savedAt: '2026-10-01T12:15:00.000Z' }] }] },
      { id: 'active', name: 'Ganzkörper A', date: '2026-10-31T12:00:00.000Z', completedAt: null, draftStartedAt: '2026-10-31T12:00:00.000Z', mode: 'template', templateId: 'a', exercises: [{ id: 'active-entry', exerciseId: 'lat', name: 'Latzug', sets: [] }] },
    ],
    maxStrengthRecords: [{ id: 'record', exerciseName: 'Latzug', date: '2026-10-01', value: 80 }],
    meta: { custom: 'unverändert' },
  };
}

test('template editing changes only the selected template while retaining identity, metadata and all training data', () => {
  const before = fixture();
  const snapshot = structuredClone(before);
  const result = updateTemplateRecord(before, 'a', { name: ' A angepasst ', exerciseTemplates: [
    { exerciseId: 'lat', repScheme: '3 × 8' },
    { exerciseId: 'row', repScheme: '2 × 12' },
  ] });
  assert.equal(result.error, null);
  assert.deepEqual(before, snapshot);
  const state = result.state;
  assert.deepEqual(state.templates[0], { ...before.templates[0], name: 'A angepasst', exerciseTemplates: [
    { ...before.templates[0].exerciseTemplates[1], repScheme: '3 × 8' },
    { ...before.templates[0].exerciseTemplates[0], name: 'Row Plate', repScheme: '2 × 12' },
  ] });
  for (const key of ['exercises', 'workouts', 'maxStrengthRecords', 'meta']) assert.strictEqual(state[key], before[key]);
  assert.strictEqual(state.templates[1], before.templates[1]);
});

test('active library exercises can be added and removed without changing the library', () => {
  const before = fixture();
  before.templates[0].exerciseTemplates = [before.templates[0].exerciseTemplates[0]];
  const result = updateTemplateRecord(before, 'a', { exerciseTemplates: [{ exerciseId: 'lat', name: 'ignored', repScheme: '2 × 15' }] });
  assert.equal(result.error, null);
  assert.deepEqual(result.state.templates[0].exerciseTemplates, [{ exerciseId: 'lat', name: 'Latzug', repScheme: '2 × 15' }]);
  assert.strictEqual(result.state.exercises, before.exercises);
  assert.strictEqual(result.state.workouts, before.workouts);
});

test('invalid names, empty templates and new duplicate or inactive references reject the entire edit', () => {
  const before = fixture();
  const snapshot = structuredClone(before);
  const validEntry = { exerciseId: 'row', repScheme: '2 × 10' };
  for (const changes of [
    { name: '' }, { name: '   ' }, { name: ' ganzkörper   b ' },
    { exerciseTemplates: [] }, { exerciseTemplates: null }, { exerciseTemplates: [null] },
    { exerciseTemplates: [{ exerciseId: 'unknown', name: 'Neu' }] },
    { exerciseTemplates: [{ exerciseId: 'old', name: 'Archivierte Übung' }] },
    { exerciseTemplates: [validEntry, validEntry] },
  ]) {
    const result = updateTemplateRecord(before, 'a', changes);
    assert.ok(result.error);
    assert.strictEqual(result.state, before);
  }
  assert.ok(updateTemplateRecord(before, 'missing', { name: 'Test' }).error);
  assert.deepEqual(before, snapshot);
});

test('existing archived, unresolved and repeated legacy entries survive reorder and rep edits without permitting new copies', () => {
  const before = fixture();
  const legacy = { exerciseId: 'unresolved', name: 'Historischer Griff', repScheme: '2 × 8', note: 'Behalten' };
  before.templates[0].exerciseTemplates = [
    { exerciseId: 'old', name: 'Archivierte Übung', repScheme: '2 × 10' },
    legacy, { ...legacy, repScheme: '2 × 12', note: 'Zweite Reihe' },
  ];
  const requested = [
    { exerciseId: 'unresolved', repScheme: '2 × 9' },
    { exerciseId: 'old', repScheme: '2 × 11' },
    { exerciseId: 'unresolved', repScheme: '2 × 13' },
  ];
  const result = updateTemplateRecord(before, 'a', { exerciseTemplates: requested });
  assert.equal(result.error, null);
  assert.deepEqual(result.state.templates[0].exerciseTemplates.map(entry => entry.name), ['Historischer Griff', 'Archivierte Übung', 'Historischer Griff']);
  assert.equal(result.state.templates[0].exerciseTemplates[0].note, 'Behalten');
  assert.equal(result.state.templates[0].exerciseTemplates[2].note, 'Zweite Reihe');
  assert.ok(updateTemplateRecord(before, 'a', { exerciseTemplates: [...requested, requested[0]] }).error);
});

test('updated templates survive the existing backup import/export round trip without changing workouts or settings', () => {
  const before = normalizeAppState(fixture());
  const result = updateTemplateRecord(before, 'a', { name: 'Plan A', exerciseTemplates: [{ ...before.templates[0].exerciseTemplates[0], repScheme: '3 × 10 · 2 Min.' }] });
  assert.equal(result.error, null);
  const restored = parseBackupPayload(JSON.stringify(createBackupPayload(result.state)));
  assert.deepEqual(restored, result.state);
  assert.deepEqual(restored.workouts, before.workouts);
  assert.deepEqual(restored.exercises, before.exercises);
});

test('removing or reordering duplicate raw rows never transfers another occurrence metadata', () => {
  const before = fixture();
  const first = { exerciseId: 'row', name: 'Erste Variante', repScheme: '2 × 8', firstOnly: 'A' };
  const second = { exerciseId: 'row', name: 'Zweite Variante', repScheme: '2 × 12', secondOnly: 'B' };
  before.templates[0].exerciseTemplates = [first, second];
  const kept = updateTemplateRecord(before, 'a', { exerciseTemplates: [{ ...second, repScheme: '3 × 10' }] });
  assert.equal(kept.error, null);
  assert.deepEqual(kept.state.templates[0].exerciseTemplates, [{ ...second, name: 'Row Plate', repScheme: '3 × 10' }]);
  const reordered = updateTemplateRecord(before, 'a', { exerciseTemplates: [second, first] });
  assert.equal(reordered.error, null);
  assert.deepEqual(reordered.state.templates[0].exerciseTemplates, [
    { ...second, name: 'Row Plate' }, { ...first, name: 'Row Plate' },
  ]);
  before.templates[0].exerciseTemplates = [
    { ...first, exerciseId: 'legacy' }, { ...second, exerciseId: 'legacy' },
  ];
  const legacy = updateTemplateRecord(before, 'a', { exerciseTemplates: [{ ...second, exerciseId: 'legacy' }] });
  assert.equal(legacy.error, null);
  assert.deepEqual(legacy.state.templates[0].exerciseTemplates, [{ ...second, exerciseId: 'legacy' }]);
});
