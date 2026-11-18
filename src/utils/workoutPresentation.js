const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

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
