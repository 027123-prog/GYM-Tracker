// Display heuristics, not measured fatigue or recovery. No state/storage writes.
import { CHEST_LOAD_PROFILES, CHEST_REGION_LABELS, resolveChestProfile } from '../data/chestRegions';
import { muscleColorStrength, muscleLoadColor } from './muscleLoadColor';
export { muscleLoadColor } from './muscleLoadColor';

export const MUSCLE_LOAD_VERSION = 'activity-5';
export const MUSCLE_LOAD_DEFAULTS = Object.freeze({
  referenceDays: 90,
  referenceWorkouts: 5,
  // Display recent training exposure, not a physiological recovery clock.
  halfLifeHours: 24,
  maxAgeDays: 5,
  colorScale: 2,
  roleWeights: Object.freeze({ primary: 1, secondary: 0.35, stabilizers: 0.08 }),
});

const DAY = 86400000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value) => typeof value === 'number' && Number.isFinite(value);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function settingsFrom(options) {
  const settings = { ...MUSCLE_LOAD_DEFAULTS, ...options, roleWeights: { ...MUSCLE_LOAD_DEFAULTS.roleWeights, ...options.roleWeights } };
  for (const key of ['referenceDays', 'referenceWorkouts', 'halfLifeHours', 'maxAgeDays', 'colorScale']) {
    if (!number(settings[key]) || settings[key] <= 0) throw new Error(`Invalid muscle load option: ${key}`);
  }
  if (!Number.isInteger(settings.referenceWorkouts)) throw new Error('referenceWorkouts must be an integer');
  for (const value of Object.values(settings.roleWeights)) {
    if (!number(value) || value < 0 || value > 1) throw new Error('Invalid muscle role weight');
  }
  return settings;
}

function dateReader(timeZone, now) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayAt = (timestamp) => {
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY;
  };
  const nowMs = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid evaluation time');
  const today = dayAt(nowMs);
  return { nowMs, parse(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const timestamp = Date.parse(`${value}T00:00:00Z`);
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
      const day = timestamp / DAY;
      return { timestamp, day, dateOnly: true, future: day > today, ageDays: today - day };
    }
    // Timezone-less times depend on the host and must not become invented instants.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return null;
    const calendar = value.slice(0, 10);
    const calendarMs = Date.parse(`${calendar}T00:00:00Z`);
    if (!Number.isFinite(calendarMs) || new Date(calendarMs).toISOString().slice(0, 10) !== calendar) return null;
    return { timestamp, day: dayAt(timestamp), dateOnly: false, future: timestamp > nowMs, ageDays: (nowMs - timestamp) / DAY };
  } };
}

function muscleWeights(mapping, settings, exerciseName) {
  const weights = new Map();
  for (const [role, weight] of Object.entries(settings.roleWeights)) {
    for (const muscle of mapping[role] || []) {
      // A duplicated muscle gets its strongest role once, not several contributions.
      weights.set(muscle, Math.max(weights.get(muscle) || 0, weight));
    }
  }
  const chestWeight = weights.get('chest');
  if (chestWeight) {
    const profile = CHEST_LOAD_PROFILES[resolveChestProfile(mapping, exerciseName)];
    for (const [id, emphasis] of Object.entries(profile)) {
      weights.set(id, Math.max(weights.get(id) || 0, chestWeight * emphasis));
    }
  }
  return Object.fromEntries(weights);
}

function describeSet(set, entry, mapping, exercise) {
  if (set.invalid === true || set.setType === 'warmup') return { excluded: 'explicitly_excluded_set' };
  // Only explicit warm-up labels count. "Leichtes Ziehen" and other free-form
  // symptom/effort descriptions must never become guessed warm-ups or RIR.
  if (/^\s*(?:wu\b|warm[\s-]?up\b|aufw(?:ä|ae)rm(?:en|satz|sätze|saetze)?\b)/iu.test(set.comment || '')) {
    return { excluded: 'explicit_warmup_note' };
  }
  const expected = mapping.analysis?.expectedMeasurement ?? exercise?.settings?.measurementType;
  if (expected === 'duration' && set.measurementType !== 'duration') return { excluded: 'missing_duration' };
  if (set.measurementType && !['reps', 'duration'].includes(set.measurementType)) return { excluded: 'unknown_measurement' };
  const duration = set.measurementType === 'duration';
  const quantity = duration ? set.durationSeconds : set.reps;
  if (!number(quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > (duration ? 86400 : 1000)) return { excluded: 'invalid_quantity' };
  const mode = set.weightMode || 'legacy';
  if (!['legacy', 'normal', 'paired', 'bodyweight', 'none'].includes(mode)) return { excluded: 'unknown_load_mode' };
  const weight = mode === 'none' ? 0 : set.weight;
  if (!number(weight) || weight < 0 || weight > 2000) return { excluded: 'invalid_weight' };
  if (mapping.analysis?.unclearLegacyLoad && mode === 'legacy') return { excluded: 'unclear_legacy_load' };
  const variantKey = set.variantKey ?? entry.variantKey ?? 'unspecified';
  const scope = mapping.variantDetails;
  if (scope?.applyToPriorWorkouts === false && (!scope.variantKey || variantKey !== scope.variantKey)) {
    return { excluded: 'prospective_variant_unverified' };
  }
  const warnings = [];
  if (mode === 'legacy') warnings.push('legacy_load_convention');
  if (mode === 'legacy' && ['paired', 'bodyweight', 'bodyweight-added', 'none'].includes(exercise?.settings?.loadType)) {
    warnings.push('current_and_historical_load_modes_differ');
  }
  if (mapping.analysis?.comparisonUncertain || entry.comparisonUncertain || set.comparisonUncertain) warnings.push('comparison_uncertain');
  if (weight === 0 && mode !== 'none') warnings.push('zero_external_load');
  const factor = mode === 'bodyweight' ? set.bodyweightFactor : null;
  if (mode === 'bodyweight' && (!number(factor) || factor <= 0 || !number(set.bodyWeight) || set.bodyWeight <= 0 || !number(set.addedWeight))) {
    return { excluded: 'incomplete_bodyweight_load' };
  }
  const key = JSON.stringify([entry.exerciseId, variantKey, mode, factor, duration ? 'duration' : 'reps']);
  return { key, duration, quantity, weight, mode, variantKey, warnings,
    rir: number(set.rir) && set.rir >= 0 && set.rir <= 10 ? set.rir : null,
    compare: !warnings.includes('current_and_historical_load_modes_differ') && !warnings.includes('comparison_uncertain'),
  };
}

// Use the second highest candidate when possible: one isolated high outlier
// cannot set the reference. Single-set sessions carry less evidence.
function sessionRepresentative(sets, value) {
  const values = sets.map(value).sort((a, b) => b - a);
  return values[Math.min(1, values.length - 1)];
}

function referenceFor(descriptor, history, date, settings) {
  if (!descriptor.compare) return null;
  let method;
  let candidates;
  if (descriptor.duration || descriptor.mode === 'none' || descriptor.weight === 0) {
    method = descriptor.duration ? 'duration' : 'repetition_capacity';
    candidates = (sets) => sets.filter(set => {
      if (descriptor.weight === 0) return set.weight === 0;
      if (descriptor.duration) return set.weight > 0;
      return true;
    });
  } else if (descriptor.quantity >= 3 && descriptor.quantity <= 12) {
    method = 'performance_index_3_to_12';
    candidates = (sets) => sets.filter(set => set.weight > 0 && set.quantity >= 3 && set.quantity <= 12);
  } else {
    method = 'same_repetitions';
    candidates = (sets) => sets.filter(set => set.weight > 0 && set.quantity === descriptor.quantity);
  }
  const sessions = (history.get(descriptor.key) || [])
    .filter(item => item.day < date.day && date.day - item.day <= settings.referenceDays)
    .map(item => ({ ...item, sets: candidates(item.sets) }))
    .filter(item => item.sets.length)
    .slice(-settings.referenceWorkouts);
  if (!sessions.length) return null;
  const value = (set) => method === 'performance_index_3_to_12'
    ? set.weight * (1 + set.quantity / 30)
    : method === 'same_repetitions' ? set.weight : set.quantity;
  return {
    method,
    value: median(sessions.map(session => sessionRepresentative(session.sets, value))),
    weight: median(sessions.map(session => sessionRepresentative(session.sets, set => set.weight))),
    workoutIds: sessions.map(session => session.workoutId),
    sessionCount: sessions.length,
    daysSinceLatest: date.day - sessions.at(-1).day,
    repeatedSets: sessions.filter(session => session.sets.length > 1).length,
  };
}

function scoreSet(descriptor, reference) {
  let relativeLoad = null;
  let relativeQuantity = null;
  let score;
  if (descriptor.duration || descriptor.mode === 'none' || descriptor.weight === 0) {
    const baseline = descriptor.duration ? 45 : 8;
    relativeQuantity = descriptor.quantity / (reference?.value || baseline);
    const quantityFactor = clamp(relativeQuantity, 0, 1.6);
    if (descriptor.duration && descriptor.weight > 0 && reference?.weight > 0) {
      relativeLoad = descriptor.weight / reference.weight;
    }
    // A logged zero external machine load can still involve body/base resistance,
    // but that unknown load must not receive the weightless-exercise baseline.
    const capacityScale = descriptor.weight === 0 && descriptor.mode !== 'none' ? 0.35 : 0.65;
    score = capacityScale * quantityFactor * (relativeLoad === null ? 1 : clamp(relativeLoad, 0, 1.5));
  } else {
    const referenceWeight = reference?.method === 'performance_index_3_to_12'
      ? reference.value / (1 + 8 / 30) : reference?.value;
    relativeLoad = referenceWeight ? descriptor.weight / referenceWeight : null;
    score = 0.75 * (relativeLoad === null ? 0.7 : clamp(relativeLoad, 0, 1.5) ** 2)
      * clamp(Math.sqrt(descriptor.quantity / 8), 0, 1.6);
  }
  // Optional structured RIR only. Comments never manufacture an RIR value.
  const effortFactor = descriptor.rir === null ? 1 : clamp(1.2 - descriptor.rir * 0.1, 0.4, 1.2);
  score *= effortFactor;
  // A first/new/ambiguous exercise has a modest baseline, not a self-normalized PR.
  const contribution = clamp(score, 0, reference ? 1.5 : 0.7);
  let confidence = reference ? Math.min(0.85, 0.4 + reference.sessionCount * 0.08 + reference.repeatedSets * 0.01) : 0.2;
  if (reference?.daysSinceLatest > 30) confidence *= 0.6;
  if (descriptor.mode === 'legacy') confidence *= 0.75;
  if (!descriptor.compare) confidence = Math.min(confidence, 0.15);
  return { contribution, relativeLoad, relativeQuantity, effortFactor, confidence };
}

/** Pure recent-exposure estimate. No medical recovery or readiness prediction. */
export function calculateMuscleLoad({ workouts = [], exercises = [], mapping, now = new Date(), timeZone = 'Europe/Berlin', options = {} }) {
  const settings = settingsFrom(options);
  const dates = dateReader(timeZone, now);
  const mappings = new Map();
  for (const item of mapping?.entries || []) {
    if (mappings.has(item.exerciseId)) throw new Error(`Duplicate muscle mapping: ${item.exerciseId}`);
    mappings.set(item.exerciseId, item);
  }
  const catalogue = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const history = new Map();
  const diagnostics = [];
  const sessions = [];
  const seenWorkouts = new Set();
  const groups = { ...mapping?.groups, ...(Object.hasOwn(mapping?.groups || {}, 'chest') ? CHEST_REGION_LABELS : {}) };
  const muscles = Object.fromEntries(Object.entries(groups).map(([id, label]) => [id, {
    id, label, rawLoad: 0, intensity: 0, displayIntensity: 0, color: muscleLoadColor(0), status: 'no_history',
    lastTrainedDate: null, currentContributions: 0, confidence: 0,
  }]));
  const accepted = [];
  for (const workout of workouts) {
    const completed = workout.completedAt ? dates.parse(workout.completedAt) : null;
    if (workout.completedAt && (!completed || completed.future)) {
      diagnostics.push({ workoutId: workout.id, reason: 'invalid_or_future_completion' });
      continue;
    }
    // A supplied invalid date is not silently replaced by the edit/completion time.
    const actualDate = typeof workout.date === 'string' && workout.date.trim() ? workout.date : workout.completedAt;
    const date = dates.parse(actualDate);
    if (!date || date.future) {
      diagnostics.push({ workoutId: workout.id, reason: 'invalid_or_future_training_date' });
      continue;
    }
    accepted.push({ workout, date, dateSource: actualDate === workout.date ? 'workout_date' : 'completion_fallback' });
  }
  accepted.sort((a, b) => a.date.day - b.date.day || a.date.timestamp - b.date.timestamp || String(a.workout.id).localeCompare(String(b.workout.id)));
  for (const { workout, date, dateSource } of accepted) {
    if (workout.id && seenWorkouts.has(workout.id)) {
      diagnostics.push({ workoutId: workout.id, reason: 'duplicate_workout' });
      continue;
    }
    if (workout.id) seenWorkouts.add(workout.id);
    const session = { workoutId: workout.id, date: workout.date || workout.completedAt, dateSource, isInProgress: !workout.completedAt,
      datePrecision: date.dateOnly ? 'day' : 'instant', ageDays: date.ageDays, sets: [], muscleContributions: {} };
    const pendingHistory = new Map();
    const seenSets = new Set();
    for (const entry of workout.exercises || []) {
      if (entry.skipped || !entry.sets?.length) continue;
      const assignment = mappings.get(entry.exerciseId);
      const diagnostic = (reason, setId) => diagnostics.push({ workoutId: workout.id, exerciseId: entry.exerciseId, ...(setId ? { setId } : {}), reason });
      if (!assignment) { diagnostic('missing_mapping'); continue; }
      if (!['draft_assigned', 'confirmed'].includes(assignment.status)) { diagnostic('unresolved_mapping'); continue; }
      const weights = muscleWeights(assignment, settings, catalogue.get(entry.exerciseId)?.name || entry.name);
      if (!Object.keys(weights).length) { diagnostic('empty_mapping'); continue; }
      if (Object.keys(weights).some(id => !muscles[id])) throw new Error(`Unknown muscle in mapping: ${entry.exerciseId}`);
      for (const set of entry.sets) {
        if (set.id && seenSets.has(set.id)) { diagnostic('duplicate_set', set.id); continue; }
        if (set.id) seenSets.add(set.id);
        const descriptor = describeSet(set, entry, assignment, catalogue.get(entry.exerciseId));
        if (descriptor.excluded) { diagnostic(descriptor.excluded, set.id); continue; }
        const reference = referenceFor(descriptor, history, date, settings);
        const score = scoreSet(descriptor, reference);
        const warnings = [...descriptor.warnings, ...(!reference ? ['no_comparable_reference'] : []), ...(descriptor.rir === null ? ['effort_not_recorded'] : [])];
        session.sets.push({ setId: set.id, exerciseId: entry.exerciseId, measurement: descriptor.duration ? 'duration' : 'reps',
          quantity: descriptor.quantity, weight: descriptor.weight, mode: descriptor.mode, variantKey: descriptor.variantKey,
          ...score, reference, warnings });
        for (const [muscle, weight] of Object.entries(weights)) {
          if (!weight) continue;
          const contribution = score.contribution * weight;
          session.muscleContributions[muscle] = (session.muscleContributions[muscle] || 0) + contribution;
          const state = muscles[muscle];
          state.lastTrainedDate = session.date;
          state.status = 'older_history';
          if (date.ageDays <= settings.maxAgeDays) {
            const decayed = contribution * 2 ** (-date.ageDays * 24 / settings.halfLifeHours);
            state.rawLoad += decayed;
            state.confidence += decayed * score.confidence;
            state.currentContributions += 1;
          }
        }
        if (descriptor.compare && workout.completedAt) {
          const list = pendingHistory.get(descriptor.key) || [];
          list.push(descriptor);
          pendingHistory.set(descriptor.key, list);
        }
      }
    }
    // Include all history for audit; only recent contributions affect color.
    sessions.push(session);
    for (const [key, sets] of pendingHistory) {
      const list = history.get(key) || [];
      list.push({ workoutId: workout.id, day: date.day, sets });
      history.set(key, list);
    }
  }
  for (const state of Object.values(muscles)) {
    if (state.rawLoad > 0) {
      state.confidence /= state.rawLoad;
      state.intensity = 1 - Math.exp(-state.rawLoad / settings.colorScale);
      state.displayIntensity = muscleColorStrength(state.intensity);
      state.color = muscleLoadColor(state.intensity);
      state.status = 'recent_history';
    }
  }
  return { version: MUSCLE_LOAD_VERSION, evaluatedAt: new Date(dates.nowMs).toISOString(), timeZone, settings, muscles, sessions, diagnostics };
}
