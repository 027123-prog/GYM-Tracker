// This correction applies only to the two records the user explicitly identified
// as the same exercise. Other Plank variants and independently created records
// are not matched by name.
const SOURCE_ID = 'exercise-coaching-20261012-plank';
const TARGET_ID = 'exercise-13ea6217-00e7-4221-8f15-ad653b68883f';

export function hasConfirmedPlankSource(state) {
  const hasSource = (entries) => Array.isArray(entries)
    && entries.some((entry) => entry?.exerciseId === SOURCE_ID);
  return (Array.isArray(state?.exercises) && state.exercises.some((exercise) => exercise?.id === SOURCE_ID))
    || (Array.isArray(state?.templates) && state.templates.some((template) => hasSource(template?.exerciseTemplates)))
    || (Array.isArray(state?.workouts) && state.workouts.some((workout) => hasSource(workout?.exercises)));
}

export function mergeConfirmedPlankRecords(state) {
  if (!hasConfirmedPlankSource(state)) return state;

  const source = state.exercises.find((exercise) => exercise.id === SOURCE_ID);
  const target = state.exercises.find((exercise) => exercise.id === TARGET_ID);
  if (!source && !target) return state;

  const notes = [...new Set([target?.settings?.setupNotes, source?.settings?.setupNotes]
    .map((note) => String(note ?? '').trim()).filter(Boolean))];
  const merged = {
    ...source,
    ...target,
    id: TARGET_ID,
    // Once the source disappears this migration no longer runs, so a later
    // user rename of the surviving record remains valid.
    name: source ? 'Plank weit' : target.name,
    settings: { ...source?.settings, ...target?.settings, setupNotes: notes.join('\n') },
    weightOptions: [...new Set([...(target?.weightOptions ?? []), ...(source?.weightOptions ?? [])])].sort((a, b) => a - b),
  };
  if ((source && !source.archivedAt) || (target && !target.archivedAt)) delete merged.archivedAt;

  const remapEntries = (entries) => entries.map((entry) =>
    entry.exerciseId === SOURCE_ID || entry.exerciseId === TARGET_ID
      ? { ...entry, exerciseId: TARGET_ID, name: merged.name }
      : entry);

  return {
    ...state,
    exercises: target
      ? state.exercises.filter((exercise) => exercise.id !== SOURCE_ID)
        .map((exercise) => exercise.id === TARGET_ID ? merged : exercise)
      : state.exercises.map((exercise) => exercise.id === SOURCE_ID ? merged : exercise),
    templates: state.templates.map((template) => ({ ...template, exerciseTemplates: remapEntries(template.exerciseTemplates) })),
    // Keep every workout entry and set, even when both former exercise IDs
    // occur in one workout. Entries can hold different notes and settings;
    // the chart already aggregates matching entries under the surviving ID.
    workouts: state.workouts.map((workout) => ({ ...workout, exercises: remapEntries(workout.exercises) })),
  };
}
