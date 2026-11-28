import { isDurationSet, parseWeightInput } from './setMeasurements.js';

const DAY = 86400000;
const warmupNote = /^\s*(?:wu\b|warm[\s-]?up\b|aufw(?:ä|ae)rm(?:en|satz|sätze)?\b)/iu;
const failureNote = /^(?:muskelversagen|keine mehr im tank|0 rir)\b/i;
const kg = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

function exerciseRange(exercise) {
  const name = exercise.name || '';
  if (['exercise-squat', 'exercise-deadlift', 'exercise-zercher-squat', 'exercise-rdl'].includes(exercise.id)
    || /kreuzheben|deadlift|\brdl\b|zercher|barbell squat|langhantel.*kniebeuge|kniebeuge.*langhantel|^kniebeugen?$/i.test(name)) return [5, 8];
  if (/face[ -]?pull|curl|bizeps|trizeps|triceps|biceps|beinbeug|beinstreck|leg extension|seitheb|lateral raise|waden|calf raise|tibial|fly|flies|butterfly|ad[bd]u[ck]t|abdu[ck]t|crunch|crunsh|isolation/i.test(name)) return [8, 11];
  return [6, 9];
}

// Derive a guided prescription without editing the source template.
export function guidedRepScheme(exercise, scheme) {
  if (!exercise || exercise.settings?.measurementType === 'duration' || !scheme) return scheme;
  const [head, ...notes] = scheme.split('·');
  if (/\b(?:sek|s|min|meter)\b/i.test(head)) return scheme;
  const [min, max] = exerciseRange(exercise);
  const range = /(\d+)\s*[x×]\s*\d+(?:\s*[-–—]\s*\d+)?/gi;
  let main = head.replace(range, (match, count) => `${count} × ${min}–${max}`);
  if (/^\s*zunächst/i.test(head) && range.test(head)) {
    const count = head.match(/(\d+)\s*[x×]/i)[1];
    main = `Zunächst ${count} × ${min}, später ${count} × ${min}–${max} `;
  }
  return [main, ...notes].join('·').trim();
}

function prescription(scheme, duration, exercise) {
  // Read the exercise prescription before rest times and RIR.
  const main = scheme.split('·')[0];
  const ranges = [...main.matchAll(/(\d+)\s*[x×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?/gi)];
  const first = ranges[0];
  const limit = duration ? 86400 : 1000;
  const [baseMin, baseMax] = duration ? [20, 60] : exerciseRange(exercise);
  const min = Math.min(limit, Number(first?.[2]) || baseMin);
  const max = Number(ranges.at(-1)?.[3] || ranges.at(-1)?.[2]) || baseMax;
  const count = Number(first?.[1] || main.match(/(\d+)\s+(?:saubere\s+)?Haltesätze/i)?.[1]) || 2;
  return {
    count: Math.min(20, count),
    min,
    max: Math.min(Math.max(min, max), limit),
    perSide: /je Seite|pro Seite/i.test(main),
    initialPhase: /zunächst/i.test(main),
  };
}

function isWarmup(set) {
  return set.setType === 'warmup' || (set.setType !== 'work' && warmupNote.test(set.comment || ''));
}

function matchesMeasurement(set, goal) {
  if (set.invalid) return false;
  if (goal.duration !== isDurationSet(set) || set.comparisonUncertain) return false;
  if (set.variantKey && set.variantKey !== goal.variant) return false;
  const quantity = goal.duration ? set.durationSeconds : set.reps;
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  let mode = set.weightMode || 'normal';
  // Unambiguous legacy paired expressions store total kg just like paired mode.
  if (mode === 'normal' && goal.mode === 'paired' && /^2x/i.test(set.weightInput || '')
    && parseWeightInput(set.weightInput)?.weight === set.weight) mode = 'paired';
  return goal.mode === mode && (mode !== 'bodyweight' || Math.abs(set.bodyweightFactor - goal.factor) < 0.00001);
}

function comparableSet(set, goal) {
  return matchesMeasurement(set, goal) && !isWarmup(set);
}

function loadOf(set, mode) {
  if (mode === 'none') return 0;
  return mode === 'bodyweight' ? set.addedWeight : set.weight;
}

function withRecentWarmups(goal, history) {
  if (goal.duration || !['normal', 'paired'].includes(goal.mode)) return goal;
  const session = history.find(({ entry }) => !entry.skipped && entry.sets.some(set => comparableSet(set, goal)));
  if (!session) return goal;
  const sets = session.entry.sets.filter(set => matchesMeasurement(set, goal) && Number.isFinite(set.weight));
  const counts = new Map();
  for (const set of sets) {
    if (!isWarmup(set)) counts.set(set.weight, (counts.get(set.weight) || 0) + 1);
  }
  const repeatedLoads = [...counts.keys()].filter(load => counts.get(load) >= 2);
  const workingLoad = Math.max(...repeatedLoads);
  const warmups = [];
  for (const set of sets) {
    const explicit = isWarmup(set);
    if (!explicit && (set.setType === 'work' || set.weight >= workingLoad || set.weight > workingLoad * 0.8)) break;
    if (set.weight < 0 || set.weight > 2000 || set.reps > 1000 || warmups.length >= 20) break;
    if (goal.load !== null && (set.weight > goal.load || (!explicit && set.weight === goal.load))) break;
    warmups.push({ load: set.weight, reps: set.reps });
  }
  return warmups.length ? { ...goal, warmups } : goal;
}

function availableWarmups(goal) {
  return (goal.warmups ?? []).filter(step => goal.load === null || step.load <= goal.load);
}

export function nextWarmup(entry) {
  const { goal, sets } = entry;
  if (!goal?.warmups?.length || entry.skipped) return null;
  const logged = sets.filter(set => matchesMeasurement(set, goal));
  if (logged.some(set => !isWarmup(set))) return null;
  return availableWarmups(goal)[logged.length] ?? null;
}

export function goalAfterSetSave(goal, set) {
  if (goal.load === null && comparableSet(set, goal)) {
    return { ...goal, load: loadOf(set, goal.mode), confirmed: false };
  }
  return goal.confirmed ? { ...goal, confirmed: false } : goal;
}

function sortedQuantities(sets, goal) {
  return sets.map(set => goal.duration ? set.durationSeconds : set.reps).sort((a, b) => b - a);
}

function seedGoal(goal, history, initialPhase) {
  // A load must occur in a full series. A lone heavy set cannot set the target.
  const count = goal.amounts.length * (goal.duration && goal.perSide ? 2 : 1);
  const sessions = history.map(({ entry }) => entry.sets.filter(set => comparableSet(set, goal))).filter(sets => sets.length);
  const failedLoads = sessions[0]?.filter(set => set.rir === 0 || failureNote.test((set.comment || '').trim()))
    .map(set => loadOf(set, goal.mode)) || [];
  const candidates = [];
  for (const sets of sessions) {
    const byLoad = new Map();
    for (const set of sets) {
      const load = loadOf(set, goal.mode);
      if (!Number.isFinite(load) || failedLoads.some(failed => load >= failed && goal.mode !== 'none')) continue;
      if (!byLoad.has(load)) byLoad.set(load, []);
      byLoad.get(load).push(set);
    }
    const working = [...byLoad.entries()].filter(([, items]) => items.length >= count)
      .sort(([a], [b]) => b - a)[0];
    if (working) candidates.push({ load: working[0], quantity: sortedQuantities(working[1], goal)[count - 1] });
    if (candidates.length === 2) break;
  }
  if (!candidates.length) {
    if (goal.duration || !['normal', 'paired'].includes(goal.mode)) return goal;
    const [opening, ...rest] = sessions[0] || [];
    if (!opening || opening.reps < goal.min + 2 || opening.rir === 0 || failureNote.test((opening.comment || '').trim())) return goal;
    if (!rest.some(set => set.weight > opening.weight && set.reps >= goal.min)) return goal;
    return { ...goal, load: opening.weight, step: 'intro' };
  }
  let load = Math.min(...candidates.map(item => item.load));
  const observed = Math.min(...candidates.map(item => item.quantity));
  const quantity = goal.duration ? Math.max(1, Math.floor(observed / 5) * 5) : observed;
  if (!goal.duration && quantity < goal.min && ['paired', 'normal'].includes(goal.mode)) {
    const easier = sessions.flat().filter(set => set.reps >= goal.min && set.weight < load
      && !failureNote.test((set.comment || '').trim()) && set.rir !== 0).map(set => set.weight);
    load = easier.length ? Math.max(...easier) : null;
  }
  const start = Math.max(goal.min, Math.min(initialPhase ? goal.min : goal.max, quantity));
  return { ...goal, load, amounts: goal.amounts.map(() => start) };
}

function goalSetGroups(entry) {
  const goal = entry.goal;
  const bilateralTime = goal.duration && goal.perSide;
  const sets = entry.skipped || goal.load === null ? [] : entry.sets.filter(set =>
    comparableSet(set, goal) && loadOf(set, goal.mode) === goal.load);
  const groups = bilateralTime ? [[], []] : [sets];
  let nextSide = 0;
  if (bilateralTime) {
    for (const set of sets) {
      const note = (set.comment || '').trim();
      const side = /^(?:l|links)\b/i.test(note) ? 0 : /^(?:r|rechts)\b/i.test(note) ? 1 : nextSide;
      groups[side].push(set);
      nextSide = 1 - side;
    }
  }
  return { groups, nextSide };
}

export function getGoalProgress(entry) {
  const goal = entry.goal;
  const { groups } = goalSetGroups(entry);
  const required = [...goal.amounts].sort((a, b) => b - a);
  let achieved = 0;
  let credited = 0;
  for (const group of groups) {
    const quantities = sortedQuantities(group, goal);
    // Match the strongest sets first so surplus reps never replace a missing set.
    required.forEach((target, index) => {
      const actual = quantities[index] || 0;
      credited += Math.min(target, actual);
    });
    let targetIndex = required.length - 1;
    for (const quantity of quantities.slice().reverse()) {
      if (targetIndex >= 0 && quantity >= required[targetIndex]) {
        achieved++;
        targetIndex--;
      }
    }
  }
  const total = required.length * groups.length;
  const complete = achieved === total;
  const fraction = credited / (required.reduce((sum, value) => sum + value, 0) * groups.length);
  return { achieved, total, complete, percent: complete ? 100 : Math.min(99, Math.round(fraction * 100)) };
}

export function getExerciseTabPercent(entry) {
  const work = getGoalProgress(entry);
  if (entry.skipped || work.complete) return work.percent;
  const logged = entry.sets.filter(set => matchesMeasurement(set, entry.goal));
  const warmupCount = logged.filter(isWarmup).length;
  const planned = availableWarmups(entry.goal).length;
  const usualCount = exerciseRange({ id: entry.exerciseId, name: entry.name })[0] === 5 ? 2 : 1;
  const credited = Math.min(warmupCount, planned || usualCount);
  // Starting work skips any remaining warm-up slots in this exercise.
  const slots = logged.length > warmupCount ? credited : planned || (credited ? usualCount : 0);
  return Math.min(99, Math.round((credited * 100 + work.percent * work.total) / (slots + work.total)));
}

export function nextGoalQuantity(entry) {
  if (!entry.goal) return null;
  const { groups, nextSide } = goalSetGroups(entry);
  const targets = [...entry.goal.amounts].sort((a, b) => b - a);
  const nextTargets = groups.map(group => {
    const quantities = sortedQuantities(group, entry.goal);
    return targets.find((target, index) => (quantities[index] || 0) < target);
  });
  return nextTargets[nextSide] ?? nextTargets.find(value => value !== undefined) ?? targets.at(-1);
}

function samePlan(a, b) {
  return a && a.mode === b.mode && a.factor === b.factor && a.duration === b.duration && a.perSide === b.perSide
    && a.amounts.length === b.amounts.length && a.min === b.min && a.max === b.max;
}

function advanceGoal(goal, exercise) {
  const low = Math.min(...goal.amounts);
  if (low < goal.max) {
    const index = goal.amounts.indexOf(low);
    goal.amounts[index] = Math.min(goal.max, low + (goal.duration ? 2 : 1));
    return;
  }
  if (goal.duration || goal.load === null || goal.mode === 'none') return;
  const name = exercise.name || '';
  let increase;
  if (goal.mode === 'bodyweight') {
    if (exercise.settings?.loadType !== 'bodyweight-added') return;
    increase = 1;
  } else {
    const deadlift = goal.mode === 'normal' && (exercise.id === 'exercise-deadlift' || /^(?:kreuzheben|deadlift)(?:$|[ -](?:vom boden|langhantel|stange|konventionell))/i.test(name));
    const barbell = goal.mode === 'normal' && (exercise.id === 'exercise-squat' || /langhantel|\bstange\b|barbell/i.test(name));
    if (deadlift || barbell) {
      increase = deadlift && goal.load >= 50 ? 5 : goal.load >= 25 ? 2.5 : 1;
    } else {
      const isolation = exerciseRange(exercise)[0] === 8;
      const cap = goal.mode === 'paired' ? 2 : isolation ? 1.25 : 5;
      const limit = Math.min(cap, goal.load * 0.1);
      const options = (exercise.weightOptions || []).filter(value =>
        Number.isFinite(value) && value > goal.load && value <= goal.load + limit);
      if (options.length) increase = Math.min(...options) - goal.load;
      else if (goal.mode === 'paired') increase = limit >= 2 ? 2 : limit >= 1 ? 1 : undefined;
    }
  }
  if (!increase || goal.load + increase > 2000) {
    goal.step = 'hold';
    return;
  }
  goal.load += increase;
  goal.amounts.fill(goal.min);
  goal.step = 'weight';
}

export function createWorkoutGoal(exercise, entry, workouts, { date, id, templateId } = {}) {
  const now = Date.parse(date ?? new Date().toISOString());
  const history = workouts.filter(w => w.id !== id && w.completedAt && Date.parse(w.completedAt) <= now
    && Date.parse(w.date) <= now && Date.parse(w.date) >= now - 42 * DAY)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .flatMap(w => {
      const match = w.exercises.find(e => e.exerciseId === exercise.id && !e.comparisonUncertain
        && (e.variantKey || '') === (entry.variantKey || ''));
      return match ? [{ entry: match, day: new Date(w.date).toLocaleDateString('sv-SE'), templateId: w.templateId }] : [];
    });
  const duration = exercise.settings?.measurementType === 'duration';
  const pastScheme = history.find(h => h.entry.targetRepScheme)?.entry.targetRepScheme || '';
  const scheme = guidedRepScheme(exercise, entry.targetRepScheme || pastScheme);
  const plan = prescription(scheme, duration, exercise);
  const type = exercise.settings?.loadType || 'normal';
  const mode = type.startsWith('bodyweight') ? 'bodyweight' : type;
  const progressByTime = duration && ['none', 'bodyweight'].includes(type)
    && /^(?:side[ -]?planks?|seitst(?:ü|ue)tz)$/i.test(exercise.name?.trim());
  const slow = exerciseRange(exercise)[0] === 5;
  const goal = {
    mode, duration, scheme, variant: entry.variantKey || '', perSide: plan.perSide,
    factor: mode === 'bodyweight' ? (exercise.settings?.bodyweightPercent || 100) / 100 : null,
    load: mode === 'none' || type === 'bodyweight' ? 0 : null,
    min: plan.min, max: plan.max, amounts: Array(plan.count).fill(plan.min),
    ...(progressByTime ? {
      progressByTime: true, perSide: true, min: 1, max: 86400, amounts: [40, 40],
      scheme: ['2 Haltesätze je Seite', ...scheme.split('·').slice(1).map(part => part.trim())].join(' · '),
    } : {}),
    confirmations: slow && !duration ? 1 : 2, weightConfirmations: 2, confirmed: false,
  };
  const scoped = history.filter(h => (h.templateId || '') === (templateId || ''));
  const guided = scoped.filter(h => h.entry.goal && !h.entry.skipped
    && h.entry.sets.some(set => comparableSet(set, h.entry.goal)));
  const previous = guided[0];
  if (!samePlan(previous?.entry.goal, goal)) {
    if (progressByTime) return goal;
    const seedHistory = /vorermüdung/i.test(scheme) ? scoped : history;
    return withRecentWarmups(seedGoal(goal, seedHistory.filter(h => !h.entry.skipped), plan.initialPhase), history);
  }
  const last = previous.entry.goal;
  const next = { ...goal, load: last.load, amounts: [...last.amounts] };
  const requiredDays = next.amounts.every(value => value === next.max) ? next.weightConfirmations : next.confirmations;
  const days = new Set();
  for (const h of guided) {
    const prior = h.entry.goal;
    if (!samePlan(prior, next) || !prior.confirmed || prior.load !== next.load ||
      !prior.amounts.every((value, i) => value === next.amounts[i]) || !getGoalProgress(h.entry).complete) break;
    days.add(h.day);
    if (days.size >= requiredDays) {
      advanceGoal(next, exercise);
      break;
    }
  }
  return withRecentWarmups(next, history);
}

export function formatWorkoutGoal(goal) {
  const equal = goal.amounts.every(value => value === goal.amounts[0]);
  const sets = equal ? `${goal.amounts.length} × ${goal.amounts[0]}` : goal.amounts.join(' / ');
  const quantity = `${sets} ${goal.duration ? 's' : 'Wdh.'}${goal.perSide ? ' je Seite' : ''}`;
  if (goal.load === null) return `${quantity} · Gewicht wählen`;
  if (goal.mode === 'none' || (goal.mode === 'bodyweight' && !goal.load)) return quantity;
  const weight = goal.mode === 'paired' ? `2 × ${kg.format(goal.load / 2)} kg` : `${kg.format(goal.load)} kg`;
  return `${weight}${goal.mode === 'bodyweight' ? ' Zusatzlast' : ''} · ${quantity}`;
}

export function formatNextGoalSet(entry) {
  const { goal } = entry;
  const warmup = nextWarmup(entry);
  const load = warmup?.load ?? goal.load;
  const quantity = warmup?.reps ?? nextGoalQuantity(entry);
  let weight = '';
  if (goal.mode === 'paired' && load !== null) weight = `2 × ${kg.format(load / 2)} kg × `;
  if (goal.mode === 'normal' && load !== null) weight = `${kg.format(load)} kg × `;
  if (goal.mode === 'bodyweight' && load) weight = `${kg.format(load)} kg Zusatzlast × `;
  return `${weight}${quantity} ${goal.duration ? 's' : 'Wdh.'}${goal.perSide ? ' je Seite' : ''}${warmup ? ' (Warm-up)' : ''}${load === null ? ' · Gewicht wählen' : ''}`;
}

export function validWorkoutGoal(goal) {
  const limit = goal?.duration ? 86400 : 1000;
  return goal && ['normal', 'paired', 'none', 'bodyweight'].includes(goal.mode)
    && typeof goal.duration === 'boolean' && typeof goal.perSide === 'boolean'
    && (goal.scheme === undefined || typeof goal.scheme === 'string')
    && (goal.mode !== 'bodyweight' || (Number.isFinite(goal.factor) && goal.factor > 0))
    && (goal.load === null || (Number.isFinite(goal.load) && Math.abs(goal.load) <= 2000
      && (goal.mode === 'bodyweight' || goal.load >= 0)))
    && Number.isInteger(goal.min) && goal.min >= 1 && Number.isInteger(goal.max) && goal.max >= goal.min && goal.max <= limit
    && (goal.warmups === undefined || (!goal.duration && ['normal', 'paired'].includes(goal.mode)
      && Array.isArray(goal.warmups) && goal.warmups.length <= 20
      && goal.warmups.every(step => Number.isFinite(step?.load) && step.load >= 0 && step.load <= 2000
        && Number.isInteger(step.reps) && step.reps >= 1 && step.reps <= 1000)))
    && Array.isArray(goal.amounts) && goal.amounts.length > 0 && goal.amounts.length <= 20
    && goal.amounts.every(n => Number.isInteger(n) && n > 0 && n <= goal.max)
    && [1, 2, 3].includes(goal.confirmations) && (goal.weightConfirmations === undefined || [1, 2, 3].includes(goal.weightConfirmations))
    && typeof goal.confirmed === 'boolean';
}
