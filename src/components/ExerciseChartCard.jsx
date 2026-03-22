import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-panel">
      <p className="text-sm font-semibold text-ink">{point.workoutName}</p>
      <p className="mt-1 text-xs text-ink/55">{new Date(point.date).toLocaleDateString('de-DE')}</p>
      <p className="mt-3 text-sm text-ink">Volumen: {point.volume.toFixed(0)} kg</p>
      <p className="mt-1 text-sm text-ink">
        Max: {point.maxWeight} kg x {point.maxWeightReps}
      </p>
      <div className="mt-3 space-y-1 text-xs text-ink/70">
        {point.sets.map((setItem) => (
          <p key={setItem.id}>
            {setItem.weight} kg x {setItem.reps}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ExerciseChartCard({ exerciseName, data }) {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine/70">Übungsdiagramm</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{exerciseName}</h2>
        </div>
        <p className="text-sm text-ink/65">X: Datum · Y: Gesamtvolumen pro Tag</p>
      </div>
      <div className="mt-6 h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#dce8e0" />
            <XAxis dataKey="shortDate" stroke="#49625a" tickLine={false} axisLine={false} />
            <YAxis stroke="#49625a" tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="volume"
              stroke="#1f5c4f"
              strokeWidth={3}
              dot={{ r: 5, fill: '#d56345', strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#d56345' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
