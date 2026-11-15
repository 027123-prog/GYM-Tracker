import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTrainingPlanImport, parseTrainingPlanImport, TRAINING_PLAN_FORMAT } from '../src/utils/trainingPlanImport.js';
import { parseBackupPayload } from '../src/utils/storage.js';

function fixture() {
  return {
    format: TRAINING_PLAN_FORMAT, version: 1,
    data: {
      exercises: [{ id: 'row', name: 'Rudern', settings: { setupNotes: 'alter Sitz' } }, { id: 'new', name: 'Neue Übung' }],
      templates: [{ id: 'a', name: 'Plan A', exerciseTemplates: [
        { exerciseId: 'row', name: 'Rudern – Schwerpunkt', repScheme: '2 × 8–12' },
        { exerciseId: 'new', name: 'Neue Übung', repScheme: '2 × 10' },
      ] }],
    },
  };
}

test('plan import preserves newer workouts, personal records, all existing settings and unrelated plans', () => {
  const state = {
    exercises: [{ id: 'row', name: 'Rudern', settings: { setupNotes: 'neuer Sitz 4' }, weightOptions: [45] }],
    templates: [{ id: 'a', name: 'Alt', exerciseTemplates: [] }, { id: 'custom', name: 'Eigener Plan', exerciseTemplates: [] }],
    workouts: [{ id: 'newer-workout', exercises: [{ name: 'Historischer Name', sets: [{ weight: 77, reps: 9 }] }] }],
    maxStrengthRecords: [{ value: 100 }], meta: { custom: 'retain' },
  };
  const snapshot = structuredClone(state);
  const imported = applyTrainingPlanImport(state, fixture());
  assert.equal(imported.workouts, state.workouts);
  assert.equal(imported.maxStrengthRecords, state.maxStrengthRecords);
  assert.equal(imported.meta, state.meta);
  assert.equal(imported.exercises[0], state.exercises[0]);
  assert.equal(imported.templates[1], state.templates[1]);
  assert.equal(imported.templates[0].exerciseTemplates[0].name, 'Rudern – Schwerpunkt');
  assert.equal(imported.exercises.length, 2);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(applyTrainingPlanImport(imported, fixture()), imported);
});

test('an exact unique catalogue name resolves a new ID without duplicating or overwriting that exercise', () => {
  const existing = { id: 'local-new', name: 'Neue Übung', settings: { setupNotes: 'behalten' } };
  const imported = applyTrainingPlanImport({ exercises: [existing], templates: [] }, fixture());
  assert.equal(imported.exercises.length, 2);
  assert.equal(imported.exercises[0], existing);
  assert.equal(imported.templates[0].exerciseTemplates[1].exerciseId, existing.id);
});

test('archived exercises and conflicting template identities fail without changing state', () => {
  const state = { exercises: [{ id: 'row', name: 'Rudern', archivedAt: '2026-01-01' }], templates: [] };
  const snapshot = structuredClone(state);
  assert.throws(() => applyTrainingPlanImport(state, fixture()), /archiviert/);
  assert.deepEqual(state, snapshot);
  assert.throws(() => applyTrainingPlanImport({ exercises: [], templates: [{ id: 'different', name: 'Plan A' }] }, fixture()), /bereits/);
});

test('ambiguous exact-name matches must be resolved before importing', () => {
  assert.throws(() => applyTrainingPlanImport({ exercises: [{ id: 'one', name: 'Rudern' }, { id: 'two', name: 'Rudern' }], templates: [] }, fixture()), /mehrfach/);
});

test('invalid references, duplicate exercises and unsupported plan versions are rejected', () => {
  const unknown = fixture(); unknown.data.templates[0].exerciseTemplates[0].exerciseId = 'missing';
  assert.throws(() => parseTrainingPlanImport(unknown), /fehlt/);
  const duplicate = fixture(); duplicate.data.exercises.push(duplicate.data.exercises[0]);
  assert.throws(() => parseTrainingPlanImport(duplicate), /ungültig/);
  const badVersion = fixture(); badVersion.version = 2;
  assert.throws(() => parseTrainingPlanImport(badVersion), /nicht unterstützt/);
});

test('a plan-only file is rejected by the full-backup parser instead of replacing user history', () => {
  assert.throws(() => parseBackupPayload(JSON.stringify(fixture())), /keine erkennbaren/);
});
