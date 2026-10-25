const formatNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export default function ExerciseChartPreview({ data, settings }) {
  const hasDuration = data.some((point) => point.maxDurationSeconds != null);
  const hasReps = data.some((point) => point.maxReps != null);
  const hasWeight = data.some((point) => point.maxWeight != null);
  const metric = hasDuration && (settings?.measurementType === 'duration' || (!hasReps && !hasWeight))
    ? { field: 'maxDurationSeconds', label: 'Längster Satz', unit: 's' }
    : hasReps && (settings?.loadType === 'none' || !hasWeight)
      ? { field: 'maxReps', label: 'Max. Wdh.', unit: 'Wdh.' }
      : { field: 'volume', label: 'Volumen', unit: 'kg' };
  const points = data.filter((point) => Number.isFinite(point[metric.field]));

  if (!points.length) {
    return <div className="flex h-20 items-center justify-center text-xs text-muted">Noch kein Verlauf</div>;
  }

  const values = points.map((point) => point[metric.field]);
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const firstDate = new Date(points[0].date).getTime();
  const timeRange = new Date(points[points.length - 1].date).getTime() - firstDate;
  const coordinates = points.map((point) => ({
    x: timeRange ? 6 + ((new Date(point.date).getTime() - firstDate) / timeRange) * 188 : 100,
    y: range ? 49 - ((point[metric.field] - min) / range) * 42 : 28,
  }));
  const last = coordinates[coordinates.length - 1];
  const latestValue = `${formatNumber.format(values[values.length - 1])} ${metric.unit}`;

  return (
    <div className="space-y-1">
      <svg viewBox="0 0 200 56" role="img" aria-label={`${metric.label}: zuletzt ${latestValue}, ${points.length} Trainings`} className="h-16 w-full text-amber" preserveAspectRatio="none">
        {coordinates.length > 1 ? <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null}
        <circle cx={last.x} cy={last.y} r="3" fill="currentColor" />
      </svg>
      <p className="flex flex-wrap justify-between gap-x-2 text-[10px] text-muted">
        <span>{metric.label}</span><span className="tabular-nums">{latestValue}</span>
      </p>
    </div>
  );
}
