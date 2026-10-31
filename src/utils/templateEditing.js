function nameKey(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export function updateTemplateRecord(state, templateId, changes = {}) {
  const template = state.templates.find((item) => item.id === templateId);
  const reject = (error) => ({ state, error });
  if (!template) return reject('Die Vorlage wurde nicht gefunden.');

  const name = String(changes.name === undefined ? template.name : changes.name ?? '').trim();
  if (!name) return reject('Bitte einen Namen eingeben.');
  if (state.templates.some((item) => item.id !== templateId && nameKey(item.name) === nameKey(name))) {
    return reject('Eine andere Vorlage heißt bereits so.');
  }

  const requested = changes.exerciseTemplates === undefined ? template.exerciseTemplates : changes.exerciseTemplates;
  if (!Array.isArray(requested) || !requested.length) return reject('Bitte mindestens eine Übung hinzufügen.');

  const library = new Map(state.exercises.map((exercise) => [exercise.id, exercise]));
  const previousEntries = new Map();
  for (const entry of template.exerciseTemplates) {
    const entries = previousEntries.get(entry.exerciseId) ?? [];
    entries.push(entry);
    previousEntries.set(entry.exerciseId, entries);
  }
  const occurrences = new Map();
  const exerciseTemplates = [];
  for (const entry of requested) {
    if (!entry || typeof entry !== 'object' || typeof entry.exerciseId !== 'string' || !entry.exerciseId) {
      return reject('Bitte eine gültige Übung auswählen.');
    }
    const previous = previousEntries.get(entry.exerciseId) ?? [];
    const occurrence = occurrences.get(entry.exerciseId) ?? 0;
    const record = library.get(entry.exerciseId);
    if ((!record || record.archivedAt) && occurrence >= previous.length) {
      return reject('Bitte eine aktive Übung aus der Bibliothek auswählen.');
    }
    if (occurrence >= Math.max(1, previous.length)) {
      return reject('Diese Übung ist bereits in der Vorlage.');
    }
    occurrences.set(entry.exerciseId, occurrence + 1);
    const previousEntry = previous[occurrence];
    // The editor sends complete named rows. Reordering/removing old duplicates
    // must not copy metadata from a different occurrence into a surviving row.
    const hasRawDuplicateRow = previous.length > 1 && Object.prototype.hasOwnProperty.call(entry, 'name');
    const priorEntry = hasRawDuplicateRow ? undefined : previousEntry;
    const exerciseName = record?.name ?? entry.name ?? previousEntry?.name;
    if (!exerciseName?.trim()) return reject('Bitte eine gültige Übung auswählen.');
    exerciseTemplates.push({
      ...priorEntry,
      ...entry,
      exerciseId: entry.exerciseId,
      name: exerciseName,
      repScheme: String(entry.repScheme === undefined ? priorEntry?.repScheme ?? '' : entry.repScheme ?? ''),
    });
  }

  return {
    error: null,
    state: {
      ...state,
      templates: state.templates.map((item) => item.id === templateId ? { ...item, name, exerciseTemplates } : item),
    },
  };
}
