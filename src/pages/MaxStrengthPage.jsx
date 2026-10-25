import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import { sortExerciseCards } from '../utils/exerciseSort';
import { formatKilograms } from '../utils/strength';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

function buildGroups(records) {
  const groups = new Map();

  records.forEach((record) => {
    const key = record.exerciseName.trim().toLocaleLowerCase('de-DE');
    const current = groups.get(key) ?? { exerciseName: record.exerciseName.trim(), values: [] };
    const date = new Date(record.date);

    current.values.push({
      ...record,
      timestamp: date.getTime(),
      dateLabel: dateFormatter.format(date),
      shortDate: shortDateFormatter.format(date),
    });
    groups.set(key, current);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      values: group.values.sort((a, b) => a.timestamp - b.timestamp),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'de'));
}

function StrengthTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-sm border border-line bg-surface-raised p-3 shadow-panel">
      <p className="font-bold text-ink">{formatKilograms(point.value)}</p>
      <p className="mt-1 text-xs text-muted">{point.dateLabel}</p>
    </div>
  );
}

function ValueForm({ exerciseName, onSave, onCancel }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const parsedValue = Number(String(value).replace(',', '.'));

    if (!exerciseName?.trim()) {
      setError('Bitte zuerst einen Übungsnamen eingeben.');
      return;
    }

    if (!Number.isFinite(parsedValue) || parsedValue <= 0 || parsedValue > 2000) {
      setError('Bitte einen Wert zwischen 0 und 2.000 kg eingeben.');
      return;
    }

    const id = onSave({ exerciseName, date, value: parsedValue });

    if (id) {
      setValue('');
      setError('');
      onCancel?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-sm border border-amber/30 bg-amber-soft p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label>
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Datum</span>
        <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label>
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Maximalkraft kg</span>
        <input
          className="field"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          placeholder="120,5"
        />
      </label>
      <div className="flex gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="secondary-button flex-1">
            Abbrechen
          </button>
        ) : null}
        <button type="submit" className="action-button flex-1">
          Speichern
        </button>
      </div>
      {error ? <p className="text-sm font-semibold text-ember sm:col-span-3">{error}</p> : null}
    </form>
  );
}

export default function MaxStrengthPage() {
  const { state, addMaxStrengthRecord, deleteMaxStrengthRecord } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const allGroups = useMemo(() => buildGroups(state.maxStrengthRecords || []), [state.maxStrengthRecords]);
  const groups = useMemo(() => {
    const normalize = (value) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const term = normalize(query.trim());
    return sortExerciseCards(allGroups
      .filter((group) => !term || normalize(group.exerciseName).includes(term))
      .map((group) => ({
        ...group,
        name: group.exerciseName,
        workoutCount: group.values.length,
        createdAt: group.values[0]?.date,
        lastTrainedAt: group.values[group.values.length - 1]?.date,
      })), 'count-desc');
  }, [allGroups, query]);
  const [selectedKey, setSelectedKey] = useState(() =>
    groups[0]?.exerciseName.toLocaleLowerCase('de-DE') ?? '',
  );
  const [addingValue, setAddingValue] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

  useEffect(() => {
    if (!groups.length) {
      setSelectedKey('');
      return;
    }

    if (!groups.some((group) => group.exerciseName.toLocaleLowerCase('de-DE') === selectedKey)) {
      setSelectedKey(groups[0].exerciseName.toLocaleLowerCase('de-DE'));
    }
  }, [groups, selectedKey]);

  useEffect(() => setAddingValue(false), [selectedKey]);

  const selectedGroup =
    groups.find((group) => group.exerciseName.toLocaleLowerCase('de-DE') === selectedKey) ?? groups[0];

  function updateSearchParams(key, value, defaultValue = '') {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  const latest = selectedGroup?.values[selectedGroup.values.length - 1];
  const best = selectedGroup?.values.reduce(
    (currentBest, item) => (!currentBest || item.value > currentBest.value ? item : currentBest),
    null,
  );
  const first = selectedGroup?.values[0];
  const delta = latest && first ? latest.value - first.value : 0;
  const values = selectedGroup?.values.map((item) => item.value) ?? [];
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const padding = Math.max((maxValue - minValue) * 0.2, maxValue * 0.04, 2);

  function handleCreateExercise(payload) {
    const id = addMaxStrengthRecord(payload);

    if (id) {
      updateSearchParams('q', '');
      setSelectedKey(payload.exerciseName.trim().toLocaleLowerCase('de-DE'));
      setCreatingExercise(false);
      setNewExerciseName('');
    }

    return id;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2 border-b border-line pb-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <span />
          <h1 className="font-display text-lg font-bold text-ink">Fortschritt</h1>
          <div className="flex justify-self-end">
            <button type="button" onClick={() => setCreatingExercise((current) => !current)} className="action-button h-11 w-11 shrink-0 px-0 text-2xl" aria-label="Maximalkraft-Übung hinzufügen" title="Übung hinzufügen" aria-expanded={creatingExercise}>+</button>
          </div>
        </div>
        <label className="block">
          <span className="sr-only">Maximalkraft-Übungen durchsuchen</span>
          <input type="search" className="field h-10 py-2" value={query} onChange={(event) => updateSearchParams('q', event.target.value)} placeholder="Suchen …" />
        </label>
      </section>

      {creatingExercise ? (
        <section className="panel p-4">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted">Neue Übung</span>
            <input
              className="field mb-3"
              value={newExerciseName}
              onChange={(event) => setNewExerciseName(event.target.value)}
              placeholder="z. B. EGYM Brustpresse"
            />
          </label>
          <ValueForm
            exerciseName={newExerciseName}
            onSave={handleCreateExercise}
            onCancel={() => setCreatingExercise(false)}
          />
        </section>
      ) : null}

      {selectedGroup ? (
        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Übung</span>
              <select
                className="field h-10 py-2 text-sm font-bold"
                aria-label="Übung"
                value={selectedKey}
                onChange={(event) => {
                  setSelectedKey(event.target.value);
                  setAddingValue(false);
                }}
              >
                {groups.map((group) => (
                  <option key={group.exerciseName} value={group.exerciseName.toLocaleLowerCase('de-DE')}>
                    {group.exerciseName}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setAddingValue((current) => !current)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-amber-soft text-xl font-bold text-amber transition hover:bg-amber/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber" aria-label="Messwert hinzufügen" title="Messwert hinzufügen" aria-expanded={addingValue}>
              +
            </button>
          </div>

          <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
            <div className="bg-surface p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Aktuell</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink sm:text-2xl">{formatKilograms(latest.value)}</p>
            </div>
            <div className="bg-surface p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Bestwert</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-deep sm:text-2xl">{formatKilograms(best.value)}</p>
            </div>
            <div className="bg-surface p-3 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Veränderung</p>
              <p className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${delta >= 0 ? 'text-sage' : 'text-ember'}`}>
                {delta >= 0 ? '+' : ''}
                {delta.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg
              </p>
            </div>
          </div>

          {addingValue ? (
            <div className="border-b border-line p-3 sm:p-4">
              <ValueForm
                exerciseName={selectedGroup.exerciseName}
                onSave={addMaxStrengthRecord}
                onCancel={() => setAddingValue(false)}
              />
            </div>
          ) : null}

          <div className="h-[260px] w-full p-2 sm:h-[340px] sm:p-4" aria-label={`Verlauf ${selectedGroup.exerciseName}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedGroup.values} margin={{ top: 16, right: 12, left: 6, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#3A3A3A" vertical={false} />
                <XAxis dataKey="shortDate" stroke="#AAA6A2" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  stroke="#AAA6A2"
                  tickLine={false}
                  axisLine={false}
                  domain={[Math.max(0, minValue - padding), maxValue + padding]}
                  tickFormatter={formatKilograms}
                  tick={{ fontSize: 11 }}
                  width={76}
                />
                <Tooltip content={<StrengthTooltip />} />
                <ReferenceLine y={latest.value} stroke="#F47A24" strokeOpacity={0.42} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Maximalkraft"
                  stroke="#F47A24"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#222222', stroke: '#F47A24', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#F47A24', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-line">
            <div className="grid grid-cols-[1fr_1fr_auto] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              <span>Datum</span>
              <span>Wert</span>
              <span className="sr-only">Aktion</span>
            </div>
            <div className="max-h-[320px] divide-y divide-line overflow-y-auto">
              {[...selectedGroup.values].reverse().map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] items-center px-4 py-2.5 text-sm">
                  <span className="text-muted">{item.dateLabel}</span>
                  <span className="font-bold tabular-nums text-ink">{formatKilograms(item.value)}</span>
                  <button
                    type="button"
                    className="danger-button min-h-9 px-3"
                    onClick={() => {
                      if (window.confirm(`Messwert vom ${item.dateLabel} wirklich löschen?`)) {
                        deleteMaxStrengthRecord(item.id);
                      }
                    }}
                    aria-label={`Messwert vom ${item.dateLabel} löschen`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {!selectedGroup ? <EmptyState title={allGroups.length ? 'Keine passende Übung' : 'Noch keine Maximalkraftwerte'} /> : null}
    </div>
  );
}
