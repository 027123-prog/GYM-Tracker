import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ChartTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-sm border border-line bg-surface-raised p-3 shadow-panel">
      <p className="text-sm font-bold text-ink">{point.workoutName}</p>
      <p className="mt-1 text-xs text-muted">{new Date(point.date).toLocaleDateString('de-DE')}</p>
      <p className="mt-3 text-sm text-ink">
        {metric === 'volume' ? `Gesamtvolumen: ${point.volume.toFixed(0)} kg` : `Max Gewicht: ${point.maxWeight} kg`}
      </p>
      <p className="mt-1 text-sm text-ink">
        Max: {point.maxWeight} kg x {point.maxWeightReps}
      </p>
      <div className="mt-3 space-y-1 text-xs text-muted">
        {point.sets.map((setItem) => (
          <p key={setItem.id}>
            {setItem.weight} kg x {setItem.reps}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ExerciseChartCard({
  exerciseName,
  data,
  canGoPrev,
  canGoNext,
  onPrevExercise,
  onNextExercise,
}) {
  const [metric, setMetric] = useState('volume');

  useEffect(() => {
    function handleKeyDown(event) {
      const tagName = event.target?.tagName;

      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
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

  const metricLabel = metric === 'volume' ? 'Gesamtvolumen' : 'Max Gewicht';
  const metricHint = metric === 'volume' ? 'X: Datum · Y: Gesamtvolumen pro Tag' : 'X: Datum · Y: Max Gewicht';
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
            <button
              type="button"
              onClick={() => setMetric('volume')}
              className={metric === 'volume' ? 'action-button' : 'secondary-button'}
            >
              Gesamtvolumen
            </button>
            <button
              type="button"
              onClick={() => setMetric('maxWeight')}
              className={metric === 'maxWeight' ? 'action-button' : 'secondary-button'}
            >
              Max Gewicht
            </button>
          </div>
          <p className="text-xs text-muted">{metricHint}</p>
        </div>
      </div>
      </div>

      <div className="h-[280px] w-full p-2 sm:h-[380px] sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="#3A3A3A" vertical={false} />
            <XAxis dataKey="shortDate" stroke="#AAA6A2" tickLine={false} axisLine={false} minTickGap={22} />
            <YAxis stroke="#AAA6A2" tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<ChartTooltip metric={metric} />} />
            <Line
              type="monotone"
              dataKey={metric === 'volume' ? 'volume' : 'maxWeight'}
              name={metricLabel}
              stroke={strokeColor}
              strokeWidth={3}
              dot={{ r: 4, fill: '#222222', stroke: dotColor, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: dotColor, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
