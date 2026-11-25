import { isDurationSet, parseWeightInput } from './setMeasurements';

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

function comparableSet(set, goal) {
  if (set.invalid || set.setType === 'warmup' || warmupNote.test(set.comment || '')) return false;
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

function loadOf(set, mode) {
  if (mode === 'none') return 0;
  return mode === 'bodyweight' ? set.addedWeight : set.weight;
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
  if (!candidates.length) return goal;
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

export function getGoalProgress(entry) {
  const goal = entry.goal;
  const bilateralTime = goal.duration && goal.perSide;
  const required = [...goal.amounts].sort((a, b) => b - a);
  const sets = entry.skipped || goal.load === null ? [] : entry.sets.filter(set =>
    comparableSet(set, goal) && loadOf(set, goal.mode) === goal.load);
  const groups = bilateralTime ? [[], []] : [sets];
  if (bilateralTime) {
    let nextSide = 0;
    for (const set of sets) {
      const note = (set.comment || '').trim();
      const side = /^(?:l|links)\b/i.test(note) ? 0 : /^(?:r|rechts)\b/i.test(note) ? 1 : nextSide;
      groups[side].push(set);
      nextSide = 1 - side;
    }
  }
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

export function nextGoalQuantity(entry) {
  if (!entry.goal) return null;
  const { achieved } = getGoalProgress(entry);
  const perTarget = entry.goal.duration && entry.goal.perSide ? 2 : 1;
  const index = Math.min(entry.goal.amounts.length - 1, Math.floor(achieved / perTarget));
  // If the first (harder) target was missed, keep it available for the next set.
  const targets = [...entry.goal.amounts].sort((a, b) => b - a);
  if (perTarget === 1 && achieved && achieved < targets.length) {
    const quantities = sortedQuantities(entry.sets.filter(set =>
      comparableSet(set, entry.goal) && loadOf(set, entry.goal.mode) === entry.goal.load), entry.goal);
    for (const target of targets) {
      if ((quantities[0] || 0) < target) return target;
      quantities.shift();
    }
  }
  return targets[index];
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
  if (goal.duration || !['normal', 'paired'].includes(goal.mode) || !goal.load) return;
  // All stored weights are total kg. A paired increase is at most 1 kg per side.
  const absoluteLimit = exerciseRange(exercise)[0] === 8 ? 1.25 : goal.mode === 'paired' ? 2 : 2.5;
  const limit = Math.min(goal.load * 0.05, absoluteLimit);
  const options = (exercise.weightOptions || []).filter(value =>
    Number.isFinite(value) && value > goal.load && value <= goal.load + limit && value <= 2000);
  // A barbell target can propose a microplate step even if it has never been logged.
  const barbell = goal.mode === 'normal' && (['exercise-squat', 'exercise-deadlift'].includes(exercise.id)
    || /langhantel|\bstange\b|barbell/i.test(exercise.name));
  if (barbell && limit >= 2.5 && goal.load <= 1997.5) options.push(goal.load + 2.5);
  if (options.length) {
    goal.load = Math.min(...options);
    goal.amounts.fill(goal.min);
    goal.step = 'weight';
  } else {
    goal.step = 'hold';
  }
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
  const slow = exerciseRange(exercise)[0] === 5;
  const goal = {
    mode, duration, scheme, variant: entry.variantKey || '', perSide: plan.perSide,
    factor: mode === 'bodyweight' ? (exercise.settings?.bodyweightPercent || 100) / 100 : null,
    load: mode === 'none' || type === 'bodyweight' ? 0 : null,
    min: plan.min, max: plan.max, amounts: Array(plan.count).fill(plan.min),
    confirmations: slow ? 3 : 2, confirmed: false,
  };
  const scoped = history.filter(h => (h.templateId || '') === (templateId || ''));
  const guided = scoped.filter(h => h.entry.goal && !h.entry.skipped && h.entry.sets.length);
  const previous = guided[0];
  if (!samePlan(previous?.entry.goal, goal)) {
    const seedHistory = /vorermüdung/i.test(scheme) ? scoped : history;
    return seedGoal(goal, seedHistory.filter(h => !h.entry.skipped), plan.initialPhase);
  }
  const last = previous.entry.goal;
  const next = { ...goal, load: last.load, amounts: [...last.amounts] };
  const days = new Set();
  for (const h of guided) {
    const prior = h.entry.goal;
    if (!samePlan(prior, next) || !prior.confirmed || prior.load !== next.load ||
      !prior.amounts.every((value, i) => value === next.amounts[i]) || !getGoalProgress(h.entry).complete) break;
    days.add(h.day);
    if (days.size >= next.confirmations) {
      advanceGoal(next, exercise);
      break;
    }
  }
  return next;
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

export function validWorkoutGoal(goal) {
  const limit = goal?.duration ? 86400 : 1000;
  return goal && ['normal', 'paired', 'none', 'bodyweight'].includes(goal.mode)
    && typeof goal.duration === 'boolean' && typeof goal.perSide === 'boolean'
    && (goal.scheme === undefined || typeof goal.scheme === 'string')
    && (goal.mode !== 'bodyweight' || (Number.isFinite(goal.factor) && goal.factor > 0))
    && (goal.load === null || (Number.isFinite(goal.load) && Math.abs(goal.load) <= 2000
      && (goal.mode === 'bodyweight' || goal.load >= 0)))
    && Number.isInteger(goal.min) && goal.min >= 1 && Number.isInteger(goal.max) && goal.max >= goal.min && goal.max <= limit
    && Array.isArray(goal.amounts) && goal.amounts.length > 0 && goal.amounts.length <= 20
    && goal.amounts.every(n => Number.isInteger(n) && n > 0 && n <= goal.max)
    && [2, 3].includes(goal.confirmations) && typeof goal.confirmed === 'boolean';
}
