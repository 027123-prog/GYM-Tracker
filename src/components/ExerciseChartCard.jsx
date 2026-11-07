import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatSetSummary } from '../utils/setMeasurements';
import { exerciseChartMetrics as chartMetrics, getExerciseChartMetricOptions, resolveExerciseChartMetric } from '../utils/workout';

function metricLabel(metric, paired) {
  if (paired && metric === 'maxWeight') return 'Max. Gesamtgewicht';
  if (paired && metric === 'durationWeight') return 'Gesamtes Haltegewicht';
  return chartMetrics[metric].label;
}

function SelectedPointDetails({ point, metric, paired, onClose }) {
  const config = chartMetrics[metric];
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
          <p className="mt-0.5 text-xs text-muted">
            {new Date(point.date).toLocaleDateString('de-DE')}
            {point.isInProgress ? <span className="ml-2 font-semibold text-amber">Läuft</span> : null}
          </p>
        </div>
        <button type="button" onClick={onClose} className="icon-button h-8 w-8" aria-label="Punktdetails schließen">
          ×
        </button>
      </div>

      <div className="mt-3 text-sm">
        <p className="flex items-center justify-between gap-3 rounded-sm bg-paper/70 px-3 py-2 text-muted">
          {metricLabel(metric, paired)}
          <strong className="font-display text-lg tabular-nums text-ink">
            {point[config.field] == null ? '–' : `${point[config.field]} ${config.unit}`}
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
      aria-label={`${new Date(payload.date).toLocaleDateString('de-DE')}, ${payload.workoutName}${payload.isInProgress ? ', läuft' : ''}`}
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
  loadType = 'normal',
  data,
  initialMetric = null,
  onMetricChange,
  canGoPrev,
  canGoNext,
  onPrevExercise,
  onNextExercise,
}) {
  const [requestedMetric, setMetric] = useState(initialMetric);
  const availableMetrics = getExerciseChartMetricOptions(data, { measurementType, loadType });
  const metric = resolveExerciseChartMetric(data, { measurementType, loadType }, requestedMetric);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const selectedPoint = data.find((point) => point.workoutId === selectedWorkoutId) ?? null;

  function selectPoint(point) {
    setSelectedWorkoutId(point.workoutId);
  }

  useEffect(() => {
    setSelectedWorkoutId(null);
  }, [exerciseName, metric]);

  useEffect(() => setMetric(initialMetric), [exerciseName, measurementType, loadType, initialMetric]);

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
  const paired = loadType === 'paired' || data.some((point) => point.sets.some((setItem) => setItem.weightMode === 'paired'));
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
              <h2 className={`font-display font-bold text-ink ${titleSizeClass}`}>{exerciseName}</h2>
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
              availableMetrics.length > 1 ? (
                <button key={option} type="button" onClick={() => { setMetric(option); onMetricChange?.(option); }} className={metric === option ? 'action-button' : 'secondary-button'} aria-pressed={metric === option}>
                  {metricLabel(option, paired)}
                </button>
              ) : <span key={option} className="text-sm text-muted">{metricLabel(option, paired)}</span>
            ))}
          </div>
          {config.hint ? <p className="text-xs text-muted">{config.hint}</p> : null}
          {paired && config.unit === 'kg' ? <p className="text-xs text-muted">Bei zwei Einzelgewichten zählt die Gesamtlast.</p> : null}
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
                selectPoint(point);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 6" stroke="#3A3A3A" vertical={false} />
            <XAxis dataKey="shortDate" stroke="#AAA6A2" tickLine={false} axisLine={false} minTickGap={22} />
            <YAxis stroke="#AAA6A2" tickLine={false} axisLine={false} width={64} unit={` ${config.unit}`} />
            <Line
              type="monotone"
              dataKey={config.field}
              name={metricLabel(metric, paired)}
              animationDuration={1250}
              stroke={strokeColor}
              strokeWidth={3}
              dot={(props) => (
                <SelectableChartDot
                  {...props}
                  color={dotColor}
                  isSelected={selectedPoint?.workoutId === props.payload?.workoutId}
                  onSelect={selectPoint}
                />
              )}
              activeDot={{ r: 6, fill: dotColor, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {selectedPoint ? (
        <SelectedPointDetails point={selectedPoint} metric={metric} paired={paired} onClose={() => setSelectedWorkoutId(null)} />
      ) : null}
    </div>
  );
}
