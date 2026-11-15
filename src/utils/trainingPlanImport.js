import { normalizeAppState } from './storage.js';

export const TRAINING_PLAN_FORMAT = 'hardgainwaf-training-plans';

const validText = value => typeof value === 'string' && value.trim().length > 0;
const nameKey = value => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');

export function parseTrainingPlanImport(payload) {
  if (payload?.format !== TRAINING_PLAN_FORMAT || payload.version !== 1) {
    throw new Error('Dieses Trainingsplanformat wird nicht unterstützt.');
  }
  const { templates, exercises } = payload.data ?? {};
  if (!Array.isArray(templates) || !templates.length || !Array.isArray(exercises)) {
    throw new Error('Die Datei enthält keine gültigen Trainingspläne.');
  }
  const exerciseIds = new Set();
  for (const exercise of exercises) {
    if (!validText(exercise?.id) || !validText(exercise?.name) || exerciseIds.has(exercise.id)) {
      throw new Error('Die Übungszuordnung in der Plandatei ist ungültig.');
    }
    exerciseIds.add(exercise.id);
  }
  const templateIds = new Set();
  const templateNames = new Set();
  const plans = templates.map(template => {
    if (!validText(template?.id) || !validText(template?.name) || templateIds.has(template.id)
      || templateNames.has(nameKey(template.name)) || !Array.isArray(template.exerciseTemplates)
      || !template.exerciseTemplates.length) {
      throw new Error('Die Vorlagen in der Plandatei sind ungültig.');
    }
    templateIds.add(template.id);
    templateNames.add(nameKey(template.name));
    const seen = new Set();
    const entries = template.exerciseTemplates.map(entry => {
      if (!validText(entry?.exerciseId) || !validText(entry?.name) || !exerciseIds.has(entry.exerciseId)
        || seen.has(entry.exerciseId) || typeof entry.repScheme !== 'string') {
        throw new Error('Eine Planübung fehlt oder ist doppelt zugeordnet.');
      }
      seen.add(entry.exerciseId);
      return { exerciseId: entry.exerciseId, name: entry.name.trim(), repScheme: entry.repScheme };
    });
    return { id: template.id, name: template.name.trim(), exerciseTemplates: entries };
  });
  return { templates: plans, exercises };
}

export function applyTrainingPlanImport(state, payload) {
  const imported = parseTrainingPlanImport(payload);
  const neededIds = new Set(imported.templates.flatMap(plan => plan.exerciseTemplates.map(entry => entry.exerciseId)));
  const exercises = [...state.exercises];
  const resolvedIds = new Map();
  for (const incoming of imported.exercises.filter(exercise => neededIds.has(exercise.id))) {
    let existing = exercises.find(exercise => exercise.id === incoming.id);
    if (!existing) {
      const matches = exercises.filter(exercise => nameKey(exercise.name) === nameKey(incoming.name));
      if (matches.length > 1) throw new Error(`„${incoming.name}“ ist mehrfach vorhanden. Bitte die Zuordnung zuerst klären.`);
      existing = matches[0];
    }
    if (existing?.archivedAt) throw new Error(`„${existing.name}“ ist archiviert. Bitte vor dem Planimport in der Bibliothek prüfen.`);
    if (existing) {
      resolvedIds.set(incoming.id, existing.id);
    } else {
      const normalized = normalizeAppState({ exercises: [incoming], templates: [], workouts: [], maxStrengthRecords: [] }).exercises[0];
      exercises.push(normalized);
      resolvedIds.set(incoming.id, normalized.id);
    }
  }
  const templates = [...state.templates];
  for (const plan of imported.templates) {
    if (templates.some(existing => existing.id !== plan.id && nameKey(existing.name) === nameKey(plan.name))) {
      throw new Error(`Eine andere Vorlage heißt bereits „${plan.name}“. Bitte vor dem Import umbenennen.`);
    }
    const next = { ...plan, exerciseTemplates: plan.exerciseTemplates.map(entry => ({ ...entry, exerciseId: resolvedIds.get(entry.exerciseId) })) };
    const index = templates.findIndex(existing => existing.id === plan.id);
    if (index === -1) templates.push(next);
    else templates[index] = { ...templates[index], ...next };
  }
  // Keep all workout snapshots, settings of existing exercises, personal records
  // and unrelated state untouched, including workouts newer than the plan file.
  return { ...state, exercises, templates };
}
