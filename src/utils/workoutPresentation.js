const numberFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export function getWorkoutLoadMetrics(stats) {
  const metrics = [
    { label: 'Volumen', value: stats.totalVolume || 0, unit: 'kg' },
    { label: 'Wiederholungen', value: stats.totalReps || 0, unit: 'Wdh.' },
    { label: 'Haltezeit', value: stats.totalDurationSeconds || 0, unit: 's' },
  ].filter((metric) => metric.value > 0);
  const [primary = { label: 'Leistung', value: null, unit: '' }, ...additional] = metrics;

  return {
    primary: { ...primary, display: primary.value === null ? '–' : numberFormatter.format(primary.value) },
    additional: additional.map((metric) => `${numberFormatter.format(metric.value)} ${metric.unit}`).join(' · '),
  };
}
