import { defaultData } from '../data/defaultData.js';
import { calculateBodyweightLoad } from './bodyweight.js';

export const STORAGE_KEY = 'gym-tracker-state-v2';
export const LEGACY_STORAGE_KEY = 'gym-tracker-state-v1';
export const LEGACY_BACKUP_KEY = 'gym-tracker-state-v1-pre-v2-backup';
export const CORRUPT_BACKUP_KEY = 'gym-tracker-state-v2-corrupt-backup';
export const PRE_IMPORT_BACKUP_KEY = 'gym-tracker-state-v2-pre-import-backup';
export const STORAGE_VERSION = 2;

const RETIRED_TEMPLATE_IDS = new Set(['template-upper', 'template-lower']);
const STALE_LEGACY_WORKOUT_MS = 12 * 60 * 60 * 1000;

const NAME_MIGRATIONS = new Map([
  ['Bankdruecken', 'Bankdrücken'],
  ['Schulterdruecken', 'Schulterdrücken'],
  ['Schraegbankdruecken', 'Schrägbankdrücken'],
  ['Ganzkoerper A', 'Ganzkörper A'],
  ['Ganzkoerper B', 'Ganzkörper B'],
  ['BankdrÃ¼cken', 'Bankdrücken'],
  ['SchulterdrÃ¼cken', 'Schulterdrücken'],
  ['SchrÃ¤gbankdrÃ¼cken', 'Schrägbankdrücken'],
  ['GanzkÃ¶rper A', 'Ganzkörper A'],
  ['GanzkÃ¶rper B', 'Ganzkörper B'],
  ['BankdrÃƒÂ¼cken', 'Bankdrücken'],
  ['SchulterdrÃƒÂ¼cken', 'Schulterdrücken'],
  ['SchrÃƒÂ¤gbankdrÃƒÂ¼cken', 'Schrägbankdrücken'],
  ['GanzkÃƒÂ¶rper A', 'Ganzkörper A'],
  ['GanzkÃƒÂ¶rper B', 'Ganzkörper B'],
  ['BankdrÃƒÆ’Ã‚Â¼cken', 'Bankdrücken'],
  ['SchulterdrÃƒÆ’Ã‚Â¼cken', 'Schulterdrücken'],
  ['BankdrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼cken', 'Bankdrücken'],
  ['SchulterdrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼cken', 'Schulterdrücken'],
]);

function migrateName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return NAME_MIGRATIONS.get(name) ?? name;
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeId(value, prefix, index) {
  return safeString(value).trim() || `${prefix}-recovered-${index}`;
}

function normalizeMachineSettings(settings) {
  return safeArray(settings)
    .map((item, index) => ({
      id: safeId(item?.id, 'setting', index),
      label: safeString(item?.label).trim(),
      value: safeString(item?.value).trim(),
    }))
    .filter((item) => item.label || item.value);
}

function normalizeSets(sets) {
  return safeArray(sets)
    .map((item, index) => {
      const bodyWeight = safeNumber(item?.bodyWeight, Number.NaN);
      const bodyweightFactor = safeNumber(item?.bodyweightFactor, Number.NaN);
      const addedWeight = safeNumber(item?.addedWeight, 0);
      const hasBodyweightData =
        item?.weightMode === 'bodyweight' &&
        Number.isFinite(bodyWeight) &&
        bodyWeight > 0 &&
        Number.isFinite(bodyweightFactor) &&
        bodyweightFactor > 0 &&
        Number.isFinite(addedWeight);
      const effectiveBodyweight = hasBodyweightData
        ? calculateBodyweightLoad(bodyWeight, bodyweightFactor, addedWeight)
        : null;

      return {
        id: safeId(item?.id, 'set', index),
        weight: effectiveBodyweight ?? Math.max(0, safeNumber(item?.weight)),
        reps: Math.max(0, Math.round(safeNumber(item?.reps))),
        comment: safeString(item?.comment).trim(),
        seatHeight: safeString(item?.seatHeight).trim(),
        savedAt: safeString(item?.savedAt),
        ...(effectiveBodyweight !== null
          ? {
              weightMode: 'bodyweight',
              bodyWeight,
              bodyweightFactor,
              addedWeight,
            }
          : {}),
      };
    })
    .filter((item) => item.reps > 0);
}

function normalizeExercises(exercises) {
  return safeArray(exercises)
    .map((exercise, index) => {
      const rawCreatedAt = safeString(exercise?.createdAt);
      const createdAtTimestamp = Date.parse(rawCreatedAt);
      const createdAt = Number.isFinite(createdAtTimestamp)
        ? new Date(createdAtTimestamp).toISOString()
        : '';
      const exerciseData = exercise && typeof exercise === 'object' ? { ...exercise } : {};
      delete exerciseData.createdAt;

      return {
        ...exerciseData,
        id: safeId(exercise?.id, 'exercise', index),
        name: migrateName(exercise?.name),
        weightOptions: [
          ...new Set(
            safeArray(exercise?.weightOptions)
              .map((value) => safeNumber(value, Number.NaN))
              .filter((value) => Number.isFinite(value) && value >= 0),
          ),
        ].sort((a, b) => a - b),
        ...(createdAt ? { createdAt } : {}),
      };
    })
    .filter((exercise) => exercise.name);
}

function normalizeWorkoutExercises(exercises) {
  return safeArray(exercises)
    .map((exercise, index) => ({
      ...exercise,
      id: safeId(exercise?.id, 'entry', index),
      exerciseId: safeId(exercise?.exerciseId, 'exercise', index),
      name: migrateName(exercise?.name),
      skipped: Boolean(exercise?.skipped),
      targetRepScheme: safeString(exercise?.targetRepScheme),
      machineSettings: normalizeMachineSettings(exercise?.machineSettings),
      sets: normalizeSets(exercise?.sets),
    }))
    .filter((exercise) => exercise.name);
}

function inferLegacyCompletedAt(workout, exercises, updatedAt) {
  const completedAt = safeString(workout?.completedAt);

  if (completedAt) {
    return completedAt;
  }

  if (Object.prototype.hasOwnProperty.call(workout ?? {}, 'draftStartedAt')) {
    return null;
  }

  const hasRecordedSets = exercises.some((exercise) => exercise.sets.length > 0);
  const updatedAtMs = Date.parse(updatedAt);

  if (
    !hasRecordedSets ||
    !Number.isFinite(updatedAtMs) ||
    Date.now() - updatedAtMs < STALE_LEGACY_WORKOUT_MS
  ) {
    return null;
  }

  return updatedAt;
}

function normalizeWorkouts(workouts) {
  return safeArray(workouts).map((workout, index) => {
    const date = safeString(workout?.date) || safeString(workout?.completedAt) || new Date(0).toISOString();
    const updatedAt = safeString(workout?.updatedAt) || date;
    const exercises = normalizeWorkoutExercises(workout?.exercises);
    const hasDraftMarker = Object.prototype.hasOwnProperty.call(workout ?? {}, 'draftStartedAt');

    return {
      ...workout,
      id: safeId(workout?.id, 'workout', index),
      name: migrateName(workout?.name) || 'Workout',
      date,
      updatedAt,
      completedAt: inferLegacyCompletedAt(workout, exercises, updatedAt),
      mode: workout?.mode === 'template' ? 'template' : 'free',
      templateId: safeString(workout?.templateId) || undefined,
      exercises,
      ...(hasDraftMarker
        ? {
            draftStartedAt: safeString(workout?.draftStartedAt) || null,
          }
        : {}),
    };
  });
}

function isRetiredTemplate(template) {
  return RETIRED_TEMPLATE_IDS.has(template.id);
}

function normalizeTemplates(templates) {
  return safeArray(templates)
    .map((template, index) => ({
      ...template,
      id: safeId(template?.id, 'template', index),
      name: migrateName(template?.name) || 'Vorlage',
      exerciseTemplates: safeArray(template?.exerciseTemplates)
        .map((exercise, exerciseIndex) => ({
          ...exercise,
          exerciseId: safeId(exercise?.exerciseId, 'exercise', exerciseIndex),
          name: migrateName(exercise?.name),
          repScheme: safeString(exercise?.repScheme),
        }))
        .filter((exercise) => exercise.name),
    }))
    .filter((template) => !isRetiredTemplate(template));
}

function normalizeMaxStrengthRecords(records) {
  return safeArray(records)
    .map((record, index) => ({
      ...record,
      id: safeId(record?.id, 'max-strength', index),
      exerciseName: migrateName(record?.exerciseName),
      date: safeString(record?.date),
      value: safeNumber(record?.value, Number.NaN),
      source: safeString(record?.source),
    }))
    .filter(
      (record) =>
        record.exerciseName &&
        record.date &&
        Number.isFinite(record.value) &&
        record.value > 0,
    );
}

function hasArray(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key) && Array.isArray(source[key]);
}

export function normalizeAppState(input = {}) {
  const parsed = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  return {
    ...defaultData,
    ...parsed,
    exercises: normalizeExercises(hasArray(parsed, 'exercises') ? parsed.exercises : defaultData.exercises),
    templates: normalizeTemplates(hasArray(parsed, 'templates') ? parsed.templates : defaultData.templates),
    workouts: normalizeWorkouts(hasArray(parsed, 'workouts') ? parsed.workouts : defaultData.workouts),
    maxStrengthRecords: normalizeMaxStrengthRecords(
      hasArray(parsed, 'maxStrengthRecords') ? parsed.maxStrengthRecords : defaultData.maxStrengthRecords,
    ),
    meta: {
      ...defaultData.meta,
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      storageVersion: STORAGE_VERSION,
      migratedFrom: parsed?.meta?.storageVersion === STORAGE_VERSION ? parsed?.meta?.migratedFrom : 'v1',
    },
  };
}

function parseStoredState(raw) {
  try {
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadAppState() {
  if (typeof window === 'undefined') {
    return normalizeAppState(defaultData);
  }

  let currentRaw = null;
  let legacyRaw = null;

  try {
    currentRaw = window.localStorage.getItem(STORAGE_KEY);
    legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return {
      ...normalizeAppState(defaultData),
      meta: {
        ...normalizeAppState(defaultData).meta,
        storageError: 'Der Browser-Speicher ist nicht verfügbar.',
      },
    };
  }

  const currentState = currentRaw ? parseStoredState(currentRaw) : null;

  if (currentState) {
    return currentState;
  }

  if (currentRaw) {
    try {
      if (!window.localStorage.getItem(CORRUPT_BACKUP_KEY)) {
        window.localStorage.setItem(CORRUPT_BACKUP_KEY, currentRaw);
      }
    } catch {
      // Der beschädigte Originalwert bleibt unter STORAGE_KEY unangetastet,
      // bis AppProvider einen erfolgreichen Speicherversuch ausführt.
    }
  }

  if (legacyRaw) {
    try {
      if (!window.localStorage.getItem(LEGACY_BACKUP_KEY)) {
        window.localStorage.setItem(LEGACY_BACKUP_KEY, legacyRaw);
      }
    } catch {
      // Die Migration darf bei knappem Speicher nicht am zusätzlichen
      // Sicherheits-Snapshot scheitern; der originale v1-Wert bleibt erhalten.
    }

    const legacyState = parseStoredState(legacyRaw);

    if (legacyState) {
      return legacyState;
    }
  }

  const fallback = normalizeAppState(defaultData);

  return currentRaw
    ? {
        ...fallback,
        meta: {
          ...fallback.meta,
          storageError: 'Beschädigte v2-Daten wurden isoliert. Bitte eine Sicherung importieren.',
        },
      }
    : fallback;
}

export function saveAppState(state) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppState(state)));
}

export function createBackupPayload(state) {
  const normalized = normalizeAppState(state);

  return {
    app: 'hardgainwaf',
    appVersion: '2.1.0',
    storageKey: STORAGE_KEY,
    storageVersion: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    summary: {
      exercises: normalized.exercises.length,
      templates: normalized.templates.length,
      workouts: normalized.workouts.length,
      maxStrengthRecords: normalized.maxStrengthRecords.length,
    },
    data: normalized,
  };
}

export function createLocalRecoveryPoint(state) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(createBackupPayload(state)));
}

export function parseBackupPayload(rawText) {
  const parsed = JSON.parse(rawText);
  const supportedAppIds = new Set(['gym-tracker', 'hardgainwaf']);
  const candidate = supportedAppIds.has(parsed?.app) ? parsed.data : parsed;

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Die Sicherungsdatei enthält keine gültigen HardGainWAF-Daten.');
  }

  const knownCollections = ['exercises', 'templates', 'workouts', 'maxStrengthRecords'];
  const hasKnownCollection = knownCollections.some((key) => Array.isArray(candidate[key]));

  if (!hasKnownCollection) {
    throw new Error('Die Sicherungsdatei enthält keine erkennbaren Datensätze.');
  }

  return normalizeAppState(candidate);
}
