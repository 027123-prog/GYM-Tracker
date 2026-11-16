import { getExerciseMuscleAssignment } from './muscleAssignments';
import { MUSCLE_GROUPS } from '../data/exerciseMuscles';
import { CHEST_LOAD_PROFILES, resolveChestProfile } from '../data/chestRegions';
import { MUSCLE_LOAD_DEFAULTS } from './muscleLoad';
import { muscleLoadColor } from './muscleLoadColor';
import { MUSCLE_VIEW_VISIBILITY } from '../data/muscleViewVisibility';

const roleLabels = { primary: 'Hauptmuskel', secondary: 'Mitwirkung', stabilizers: 'Stabilisierung' };

export function chooseExerciseMuscleView(rows) {
  let front = 0, back = 0;
  for (const row of rows) {
    const visible = MUSCLE_VIEW_VISIBILITY[row.id];
    const total = (visible?.front ?? 0) + (visible?.back ?? 0);
    if (!total || !(row.weight > 0)) continue;
    // Prioritize strongly involved regions over a collection of light stabilizers.
    // Normalize each region so large surface areas do not dominate automatically.
    const priority = row.weight ** 2;
    front += priority * visible.front / total;
    back += priority * visible.back / total;
  }
  return back > front ? 'back' : 'front';
}

// A prospective exercise profile, independent of logged load, history and rest.
// Weights describe our catalogue heuristic, never measured activation percentages.
export function buildExerciseMuscleProfile(exercise) {
  const assignment = exercise ? getExerciseMuscleAssignment(exercise) : null;
  if (!assignment || !['draft_assigned', 'confirmed'].includes(assignment.status)) {
    return { status: assignment?.status === 'tentative_variant' ? 'tentative' : 'unassigned', rows: [], muscles: {}, defaultView: 'front' };
  }
  const contributions = new Map();
  const add = (id, weight, role) => {
    if (!Object.hasOwn(MUSCLE_GROUPS, id) || !(weight > 0)) return;
    if (weight > (contributions.get(id)?.weight ?? 0)) contributions.set(id, { id, weight, role });
  };
  for (const [role, roleWeight] of Object.entries(MUSCLE_LOAD_DEFAULTS.roleWeights)) {
    for (const id of assignment[role] ?? []) {
      if (id === 'chest') {
        for (const [region, emphasis] of Object.entries(CHEST_LOAD_PROFILES[resolveChestProfile(assignment, exercise.name)])) {
          add(region, roleWeight * emphasis, role);
        }
      } else add(id, roleWeight, role);
    }
  }
  const rows = [...contributions.values()].map(item => {
    // Keep even light stabilization visible in this categorical exercise view.
    // The dashboard's time-decayed load colors are deliberately not modified.
    const intensity = 0.18 + 0.82 * Math.sqrt(item.weight);
    return { ...item, label: MUSCLE_GROUPS[item.id], roleLabel: roleLabels[item.role], intensity,
      strengthLabel: item.weight >= 0.7 ? 'Stark' : item.weight >= 0.25 ? 'Mittel' : 'Leicht',
      color: muscleLoadColor(intensity) };
  }).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, 'de'));
  return { status: rows.length ? 'assigned' : 'unassigned', rows, defaultView: chooseExerciseMuscleView(rows),
    muscles: Object.fromEntries(rows.map(item => [item.id, { intensity: item.intensity }])) };
}

export function normalizeExerciseLibraryLayout(value) {
  return value === 'list' || value === 'body' ? value : 'graph';
}

