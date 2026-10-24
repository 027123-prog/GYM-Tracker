import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatSetSummary, isDurationSet } from '../utils/setMeasurements';

const chartMetrics = {
  volume: { field: 'volume', label: 'Volumen (Wdh.)', unit: 'kg', hint: 'Gewicht × Wiederholungen pro Training' },
  maxWeight: { field: 'maxWeight', label: 'Max. Gewicht (Wdh.)', unit: 'kg', hint: 'Höchstes Gewicht bei Wiederholungssätzen' },
  duration: { field: 'maxDurationSeconds', label: 'Längste Haltezeit', unit: 's', hint: 'Längster einzelner Haltesatz pro Training' },
  durationWeight: { field: 'maxDurationWeight', label: 'Haltegewicht', unit: 'kg', hint: 'Höchstes Gewicht bei Zeitsätzen · Dauer im Punktdetail' },
};

function SelectedPointDetails({ point, metric, onClose }) {
  const config = chartMetrics[metric];
  const duration = metric === 'duration' || metric === 'durationWeight';
  const highlightedSet = point.sets.find((setItem) => duration
    ? isDurationSet(setItem) && (metric === 'duration'
      ? setItem.durationSeconds === point.maxDurationSeconds
      : setItem.weight === point.maxDurationWeight)
    : !isDurationSet(setItem) && setItem.weight === point.maxWeight);
  const comments = point.sets
    .map((setItem, index) => ({
      id: setItem.id,
      label: `Satz ${index + 1}`,
      text: setItem.comment?.trim() ?? '',
    }))
    .filter((comment) => comment.text);

  return (
    <div
      id="chart-point-details"
      role="status"
      aria-live="polite"
      className="border-t border-line bg-surface-raised px-4 py-3 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-ink">{point.workoutName}</p>
          <p className="mt-0.5 text-xs text-muted">{new Date(point.date).toLocaleDateString('de-DE')}</p>
        </div>
        <button type="button" onClick={onClose} className="icon-button h-8 w-8" aria-label="Punktdetails schließen">
          ×
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-sm bg-paper/70 px-3 py-2 text-muted">
          {config.label}
          <strong className="mt-0.5 block font-display text-lg tabular-nums text-ink">
            {point[config.field] == null ? '–' : `${point[config.field]} ${config.unit}`}
          </strong>
        </p>
        <p className="rounded-sm bg-paper/70 px-3 py-2 text-muted">
          {duration ? 'Haltesatz' : 'Satz mit höchstem Gewicht'}
          <strong className="mt-0.5 block font-display text-lg tabular-nums text-ink">
            {highlightedSet ? formatSetSummary(highlightedSet) : '–'}
          </strong>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {point.sets.map((setItem, index) => (
          <span key={setItem.id} className="rounded-sm bg-paper/70 px-2.5 py-1.5 text-xs text-muted">
            {index + 1}. <strong className="text-ink">{formatSetSummary(setItem)}</strong>
          </span>
        ))}
      </div>

      {comments.length ? (
        <div className="mt-3 space-y-0.5 text-[10px] italic leading-relaxed text-muted">
          {comments.map((comment) => (
            <p key={comment.id}>
              {comment.label}: {comment.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectableChartDot({ cx, cy, payload, color, isSelected, onSelect }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload) {
    return null;
  }

  function selectPoint(event) {
    event.stopPropagation();
    onSelect(payload);
  }

  return (
    <g
      role="button"
      tabIndex="0"
      aria-label={`${new Date(payload.date).toLocaleDateString('de-DE')}, ${payload.workoutName}`}
      aria-pressed={isSelected}
      aria-controls="chart-point-details"
      onClick={selectPoint}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectPoint(event);
        }
      }}
      className="cursor-pointer"
    >
      <circle cx={cx} cy={cy} r="14" fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 6 : 4}
        fill={isSelected ? color : '#222222'}
        stroke={color}
        strokeWidth="2"
      />
    </g>
  );
}

export default function ExerciseChartCard({
  exerciseName,
  measurementType = 'reps',
  data,
  canGoPrev,
  canGoNext,
  onPrevExercise,
  onNextExercise,
}) {
  const [requestedMetric, setMetric] = useState(null);
  const hasReps = data.some((point) => point.maxWeight != null);
  const hasDuration = data.some((point) => point.maxDurationSeconds != null);
  const availableMetrics = [
    ...(hasReps ? ['volume', 'maxWeight'] : []),
    ...(hasDuration ? ['duration'] : []),
    ...(data.some((point) => point.maxDurationWeight > 0) ? ['durationWeight'] : []),
  ];
  const defaultMetric = hasDuration && (measurementType === 'duration' || !hasReps) ? 'duration' : 'volume';
  const metric = availableMetrics.includes(requestedMetric) ? requestedMetric : defaultMetric;
  const [selectedPoint, setSelectedPoint] = useState(null);
  const dataSignature = data
    .map(
      (point) =>
        `${point.date}:${point.volume}:${point.maxWeight}:${point.sets
          .map((setItem) => `${setItem.id}:${formatSetSummary(setItem)}:${setItem.comment ?? ''}`)
          .join(',')}`,
    )
    .join('|');

  useEffect(() => {
    setSelectedPoint(null);
  }, [dataSignature, exerciseName, metric]);

  useEffect(() => setMetric(null), [exerciseName, measurementType]);

  useEffect(() => {
    function handleKeyDown(event) {
      const tagName = event.target?.tagName;

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || event.target?.isContentEditable || event.target?.closest?.('[role="dialog"]')) {
        return;
      }

      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        onNextExercise();
      }

      if (event.key === 'ArrowLeft' && canGoPrev) {
        event.preventDefault();
        onPrevExercise();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrev, onNextExercise, onPrevExercise]);

  const config = chartMetrics[metric];
  const metricLabel = config.label;
  const metricHint = `X: Datum · Y: ${config.unit} · ${config.hint}`;
  const strokeColor = metric === 'volume' ? '#F47A24' : '#73B991';
  const dotColor = metric === 'volume' ? '#F47A24' : '#73B991';
  const titleSizeClass = exerciseName.length > 22 ? 'text-2xl' : 'text-3xl';

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevExercise}
              disabled={!canGoPrev}
              className="icon-button"
              aria-label="Vorherige Übung"
            >
              ←
            </button>
            <div className="min-w-0">
              <p className="eyebrow">Übungsverlauf</p>
              <h2 className={`mt-1 font-display font-bold text-ink ${titleSizeClass}`}>{exerciseName}</h2>
            </div>
            <button
              type="button"
              onClick={onNextExercise}
              disabled={!canGoNext}
              className="icon-button"
              aria-label="Nächste Übung"
            >
              →
            </button>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {availableMetrics.map((option) => (
              <button key={option} type="button" onClick={() => setMetric(option)} className={metric === option ? 'action-button' : 'secondary-button'}>
                {chartMetrics[option].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{metricHint}</p>
        </div>
      </div>
      </div>

      <div className="h-[280px] w-full p-2 sm:h-[380px] sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, left: 0, bottom: 6 }}
            onClick={(chartState) => {
              const point = chartState?.activePayload?.[0]?.payload;

              if (point) {
                setSelectedPoint(point);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 6" stroke="#3A3A3A" vertical={false} />
            <XAxis dataKey="shortDate" stroke="#AAA6A2" tickLine={false} axisLine={false} minTickGap={22} />
            <YAxis stroke="#AAA6A2" tickLine={false} axisLine={false} width={52} />
            <Line
              type="monotone"
              dataKey={config.field}
              name={metricLabel}
              stroke={strokeColor}
              strokeWidth={3}
              dot={(props) => (
                <SelectableChartDot
                  {...props}
                  color={dotColor}
                  isSelected={selectedPoint?.date === props.payload?.date}
                  onSelect={setSelectedPoint}
                />
              )}
              activeDot={{ r: 6, fill: dotColor, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasDuration ? <p className="border-t border-line px-4 py-2 text-xs text-muted">Haltezeit und Wiederholungsvolumen werden getrennt ausgewertet.</p> : null}
      {selectedPoint ? (
        <SelectedPointDetails point={selectedPoint} metric={metric} onClose={() => setSelectedPoint(null)} />
      ) : (
        <p className="border-t border-line px-4 py-2 text-center text-[11px] text-muted">
          Punkt antippen, Details erscheinen unter dem Diagramm.
        </p>
      )}
    </div>
  );
}
