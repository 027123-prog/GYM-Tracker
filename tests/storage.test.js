import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_BACKUP_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  createBackupPayload,
  loadAppState,
  normalizeAppState,
  parseBackupPayload,
} from '../src/utils/storage.js';

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

test('normalizeAppState migriert Namen und bereinigt beschädigte v1-Daten', () => {
  const completedAt = '2026-07-01T18:00:00.000Z';
  const normalized = normalizeAppState({
    exercises: [
      {
        id: '',
        name: ' Bankdruecken ',
        weightOptions: [20, '10', 20, -1, 'ungültig'],
        createdAt: '2026-06-15T12:00:00.000Z',
      },
      { id: 'exercise-empty', name: '   ', weightOptions: [10] },
    ],
    templates: [
      {
        id: 'template-upper',
        name: 'Upper Push/Pull',
        exerciseTemplates: [],
      },
      {
        id: '',
        name: ' Ganzkoerper A ',
        exerciseTemplates: [
          {
            exerciseId: '',
            name: 'Schulterdruecken',
            repScheme: 8,
          },
          { exerciseId: 'empty', name: '', repScheme: '3 x 8' },
        ],
      },
    ],
    workouts: [
      {
        id: '',
        name: ' Ganzkoerper B ',
        completedAt,
        mode: 'unbekannt',
        exercises: [
          {
            id: '',
            exerciseId: '',
            name: 'Schulterdruecken',
            skipped: 1,
            machineSettings: [
              { id: '', label: ' Sitz ', value: ' 4 ' },
              { id: 'empty', label: '', value: '' },
            ],
            sets: [
              {
                id: '',
                weight: -12,
                reps: '7.6',
                comment: ' sauber ',
                seatHeight: ' 4 ',
                savedAt: 42,
              },
              { id: 'set-invalid', weight: 50, reps: 0 },
            ],
          },
        ],
      },
    ],
    maxStrengthRecords: [
      {
        id: '',
        exerciseName: 'Bankdruecken',
        date: '2026-06-01',
        value: '101.5',
        source: 42,
      },
      {
        id: 'invalid-record',
        exerciseName: 'Bankdruecken',
        date: '2026-06-02',
        value: -1,
      },
    ],
    meta: { storageVersion: 1, customFlag: true },
  });

  assert.deepEqual(normalized.exercises, [
    {
      id: 'exercise-recovered-0',
      name: 'Bankdrücken',
      weightOptions: [10, 20],
      createdAt: '2026-06-15T12:00:00.000Z',
    },
  ]);

  assert.equal(normalized.templates.length, 1, 'ausgemusterte Vorlagen werden entfernt');
  assert.equal(normalized.templates[0].id, 'template-recovered-1');
  assert.equal(normalized.templates[0].name, 'Ganzkörper A');
  assert.deepEqual(normalized.templates[0].exerciseTemplates, [
    {
      exerciseId: 'exercise-recovered-0',
      name: 'Schulterdrücken',
      repScheme: '',
    },
  ]);

  assert.equal(normalized.workouts[0].id, 'workout-recovered-0');
  assert.equal(normalized.workouts[0].name, 'Ganzkörper B');
  assert.equal(normalized.workouts[0].date, completedAt);
  assert.equal(normalized.workouts[0].updatedAt, completedAt);
  assert.equal(normalized.workouts[0].mode, 'free');
  assert.deepEqual(normalized.workouts[0].exercises[0], {
    id: 'entry-recovered-0',
    exerciseId: 'exercise-recovered-0',
    name: 'Schulterdrücken',
    skipped: true,
    targetRepScheme: '',
    machineSettings: [
      {
        id: 'setting-recovered-0',
        label: 'Sitz',
        value: '4',
      },
    ],
    sets: [
      {
        id: 'set-recovered-0',
        weight: 0,
        reps: 8,
        comment: 'sauber',
        seatHeight: '4',
        savedAt: '',
      },
    ],
  });

  assert.deepEqual(normalized.maxStrengthRecords, [
    {
      id: 'max-strength-recovered-0',
      exerciseName: 'Bankdrücken',
      date: '2026-06-01',
      value: 101.5,
      source: '',
    },
  ]);
  assert.equal(normalized.meta.storageVersion, STORAGE_VERSION);
  assert.equal(normalized.meta.migratedFrom, 'v1');
  assert.equal(normalized.meta.customFlag, true);
});

test('normalizeAppState entfernt ungültige Übungs-Zeitstempel', () => {
  const normalized = normalizeAppState({
    exercises: [
      {
        id: 'exercise-invalid-created-at',
        name: 'Rudern',
        weightOptions: [],
        createdAt: 'kein-datum',
      },
    ],
    templates: [],
    workouts: [],
    maxStrengthRecords: [],
    meta: {},
  });

  assert.equal(Object.hasOwn(normalized.exercises[0], 'createdAt'), false);
});

test('alte Legacy-Workouts mit Sätzen werden abgeschlossen, echte neue Drafts bleiben offen', () => {
  const legacyUpdatedAt = '2026-01-15T19:30:00.000Z';
  const normalized = normalizeAppState({
    exercises: [],
    templates: [],
    maxStrengthRecords: [],
    workouts: [
      {
        id: 'legacy-workout',
        name: 'Altes Training',
        date: '2026-01-15T18:00:00.000Z',
        updatedAt: legacyUpdatedAt,
        completedAt: null,
        exercises: [
          {
            id: 'legacy-entry',
            exerciseId: 'legacy-exercise',
            name: 'Kniebeugen',
            sets: [{ id: 'legacy-set', weight: 80, reps: 8 }],
          },
        ],
      },
      {
        id: 'current-draft',
        name: 'Aktuelles Training',
        date: legacyUpdatedAt,
        updatedAt: legacyUpdatedAt,
        completedAt: null,
        draftStartedAt: legacyUpdatedAt,
        exercises: [
          {
            id: 'current-entry',
            exerciseId: 'current-exercise',
            name: 'Bankdrücken',
            sets: [{ id: 'current-set', weight: 60, reps: 8 }],
          },
        ],
      },
    ],
  });

  assert.equal(normalized.workouts[0].completedAt, legacyUpdatedAt);
  assert.equal(normalized.workouts[1].completedAt, null);
  assert.equal(normalized.workouts[1].draftStartedAt, legacyUpdatedAt);
});

test('loadAppState migriert Legacy-Daten und bewahrt das unveränderte v1-Backup', () => {
  const legacyState = {
    exercises: [
      {
        id: 'exercise-bench',
        name: 'Bankdruecken',
        weightOptions: ['60', 60, 65],
      },
    ],
    templates: [],
    workouts: [],
    maxStrengthRecords: [],
    meta: { storageVersion: 1 },
  };
  const legacyRaw = JSON.stringify(legacyState);
  const localStorage = createMemoryStorage({
    [LEGACY_STORAGE_KEY]: legacyRaw,
  });
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage };

  try {
    const migrated = loadAppState();

    assert.equal(migrated.exercises[0].name, 'Bankdrücken');
    assert.deepEqual(migrated.exercises[0].weightOptions, [60, 65]);
    assert.equal(migrated.meta.storageVersion, STORAGE_VERSION);
    assert.equal(migrated.meta.migratedFrom, 'v1');
    assert.equal(localStorage.getItem(LEGACY_BACKUP_KEY), legacyRaw);
    assert.equal(localStorage.getItem(STORAGE_KEY), null);
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test('parseBackupPayload lehnt syntaktisch und strukturell ungültige Importe ab', () => {
  assert.throws(() => parseBackupPayload('{kein json'), SyntaxError);
  assert.throws(
    () => parseBackupPayload(JSON.stringify({ app: 'gym-tracker', data: null })),
    /keine gültigen HardGainWAF-Daten/,
  );
  assert.throws(
    () => parseBackupPayload(JSON.stringify({ einstellungen: { theme: 'dark' } })),
    /keine erkennbaren Datensätze/,
  );
});

test('Backup-Export und -Import ergeben einen verlustfreien normalisierten Roundtrip', () => {
  const source = {
    exercises: [
      {
        id: 'exercise-bench',
        name: 'Bankdruecken',
        weightOptions: [70, '60', 70],
      },
    ],
    templates: [],
    workouts: [
      {
        id: 'workout-1',
        name: 'Abendtraining',
        date: '2026-07-20T18:00:00.000Z',
        completedAt: '2026-07-20T19:00:00.000Z',
        exercises: [
          {
            id: 'entry-1',
            exerciseId: 'exercise-bench',
            name: 'Bankdruecken',
            sets: [
              {
                id: 'set-1',
                weight: 999,
                reps: 5,
                comment: 'PR',
                weightMode: 'bodyweight',
                bodyWeight: 80,
                bodyweightFactor: 1,
                addedWeight: -10,
              },
            ],
          },
        ],
      },
    ],
    maxStrengthRecords: [
      {
        id: 'max-1',
        exerciseName: 'Bankdruecken',
        date: '2026-07-20',
        value: 82.5,
        source: 'Training',
      },
    ],
  };

  const backup = createBackupPayload(source);
  const restored = parseBackupPayload(JSON.stringify(backup));

  assert.equal(backup.app, 'hardgainwaf');
  assert.equal(backup.appVersion, '2.0.0');
  assert.equal(backup.storageKey, STORAGE_KEY);
  assert.equal(backup.storageVersion, STORAGE_VERSION);
  assert.match(backup.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(backup.summary, {
    exercises: 1,
    templates: 0,
    workouts: 1,
    maxStrengthRecords: 1,
  });
  const restoredBodyweightSet = restored.workouts[0].exercises[0].sets[0];
  assert.equal(restoredBodyweightSet.weight, 70);
  assert.equal(restoredBodyweightSet.weightMode, 'bodyweight');
  assert.equal(restoredBodyweightSet.bodyWeight, 80);
  assert.equal(restoredBodyweightSet.bodyweightFactor, 1);
  assert.equal(restoredBodyweightSet.addedWeight, -10);
  assert.deepEqual(restored, backup.data);
});

test('ungültige Körpergewichtsformeln werden beim Import nicht als widersprüchliche Metadaten bewahrt', () => {
  const normalized = normalizeAppState({
    exercises: [],
    templates: [],
    workouts: [
      {
        id: 'workout-bodyweight-invalid',
        name: 'Importtest',
        date: '2026-07-20T18:00:00.000Z',
        completedAt: '2026-07-20T19:00:00.000Z',
        exercises: [
          {
            id: 'entry-bodyweight-invalid',
            exerciseId: 'exercise-pull-up',
            name: 'Pull Up',
            sets: [
              {
                id: 'set-bodyweight-invalid',
                weight: 70,
                reps: 5,
                weightMode: 'bodyweight',
                bodyWeight: 80,
                bodyweightFactor: 1,
                addedWeight: -100,
              },
            ],
          },
        ],
      },
    ],
    maxStrengthRecords: [],
  });
  const normalizedSet = normalized.workouts[0].exercises[0].sets[0];

  assert.equal(normalizedSet.weight, 70);
  assert.equal('weightMode' in normalizedSet, false);
  assert.equal('bodyWeight' in normalizedSet, false);
  assert.equal('bodyweightFactor' in normalizedSet, false);
  assert.equal('addedWeight' in normalizedSet, false);
});
