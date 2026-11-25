import { getSetRepVolume } from './setMeasurements';

const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

function sumSetVolume(sets) {
  return sets.reduce((total, set) => total + getSetRepVolume(set), 0);
}

export function getExerciseVolumeProgress(exercise, history) {
  if (exercise.skipped) return null;

  const volumes = history.map((session) => sumSetVolume(session.sets))
    .filter((volume) => Number.isFinite(volume) && volume > 0)
    .slice(0, 6);
  if (!volumes.length) return null;

  let target = volumes[0];
  if (volumes.length >= 4) {
    const earlier = volumes.slice(1).sort((left, right) => left - right);
    const center = Math.floor(earlier.length / 2);
    const typical = earlier.length % 2 ? earlier[center] : (earlier[center - 1] + earlier[center]) / 2;
    target = volumes.find((volume) => volume >= typical * 0.6 && volume <= typical * 1.4);
    if (!target) return null;
  }

  return Math.round(sumSetVolume(exercise.sets) / target * 100);
}

const alternativeFamilies = [
  /bankdrück|bankdrueck|bench press|brustpresse|chest press/i,
  /hip[ -]?thrust/i,
  /face[ -]?pull/i,
  /rudern|\brow\b/i,
  /crunch|crunsh/i,
];

export function getWorkoutAlternatives(library, workout, active, history) {
  if (!workout?.guided) return [];
  const family = alternativeFamilies.find(pattern => pattern.test(active?.name ?? ''));
  const present = new Set(workout.exercises.map(entry => entry.exerciseId));
  const planExtras = new Set();
  const trained = new Set();
  for (const session of history) {
    if (!session.completedAt) continue;
    const samePlan = (workout.templateId && session.templateId === workout.templateId) || session.name === workout.name;
    for (const entry of session.exercises) {
      if (entry.skipped || !entry.sets.length) continue;
      trained.add(entry.exerciseId);
      if (samePlan) planExtras.add(entry.exerciseId);
    }
  }
  const available = library.filter(item => !item.archivedAt && !present.has(item.id));
  const similar = available.filter(item => family?.test(item.name) && trained.has(item.id));
  return [...similar, ...available.filter(item => planExtras.has(item.id) && !similar.includes(item))];
}

export function splitExerciseName(name) {
  const parts = name.match(/^(.+?)(?:\s+-\s+|\s*[–—]\s*)(.+)$/);
  return parts
    ? { mainName: parts[1].trim(), nameDetail: parts[2].trim() }
    : { mainName: name, nameDetail: '' };
}

export function getWorkoutLoadMetrics(stats, { showAdditionalDuration = true } = {}) {
  const metrics = [
    { label: 'Volumen', value: stats.totalVolume || 0, unit: 'kg' },
    { label: 'Wiederholungen', value: stats.totalReps || 0, unit: 'Wdh.' },
    { label: 'Haltezeit', value: stats.totalDurationSeconds || 0, unit: 's' },
  ].filter((metric) => metric.value > 0);
  const [primary = { label: 'Leistung', value: null, unit: '' }, ...additional] = metrics;

  return {
    primary: { ...primary, display: primary.value === null ? '–' : numberFormatter.format(primary.value) },
    additional: additional
      .filter((metric) => showAdditionalDuration || metric.unit !== 's')
      .map((metric) => `${numberFormatter.format(metric.value)} ${metric.unit}`)
      .join(' · '),
  };
}
