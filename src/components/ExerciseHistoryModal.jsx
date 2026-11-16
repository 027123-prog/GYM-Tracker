import { useState } from 'react';
import ModalShell from './ModalShell';
import { formatDate, formatSetTime } from '../utils/date';
import { formatSetSummary } from '../utils/setMeasurements';

export default function ExerciseHistoryModal({ exerciseName, history, onClose }) {
  const [index, setIndex] = useState(0);
  const snapshot = history[index];
  return <ModalShell isOpen onClose={onClose} labelledBy="exercise-history-title" maxWidth="max-w-lg">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="eyebrow">{exerciseName}</p>
        <h2 id="exercise-history-title" className="mt-2 font-display text-xl font-bold text-ink">Bisherige Trainings</h2>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Verlauf schließen">×</button>
    </div>
    {snapshot ? <>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className="secondary-button" disabled={index >= history.length - 1}
          onClick={() => setIndex(value => value + 1)} aria-label="Älteres Training">← Davor</button>
        <span className="text-xs tabular-nums text-muted">{index + 1} / {history.length}</span>
        <button type="button" className="secondary-button" disabled={index === 0}
          onClick={() => setIndex(value => value - 1)} aria-label="Neueres Training">Danach →</button>
      </div>
      <div aria-live="polite" className="mt-4">
        <p className="font-bold text-ink">{snapshot.workoutDate ? formatDate(snapshot.workoutDate) : 'Datum unbekannt'}</p>
        <p className="mt-1 text-sm text-muted">{snapshot.workoutName}</p>
        <ol className="mt-3 divide-y divide-line">
          {snapshot.sets.map((item, setIndex) => <li key={`${item.id ?? setIndex}-${setIndex}`} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold text-ink"><span className="mr-2 text-xs text-muted">Satz {setIndex + 1}</span>{formatSetSummary(item)}</p>
              {formatSetTime(item.savedAt) ? <time dateTime={item.savedAt} className="text-xs tabular-nums text-muted">{formatSetTime(item.savedAt)} Uhr</time> : null}
            </div>
            {item.comment ? <p className="mt-1 whitespace-pre-wrap text-sm italic text-muted">{item.comment}</p> : null}
            {item.seatHeight ? <p className="mt-1 text-xs text-muted">Sitzhöhe: {item.seatHeight}</p> : null}
          </li>)}
        </ol>
        {snapshot.machineSettings?.length ? <p className="mt-3 text-xs text-muted">
          {snapshot.machineSettings.filter(item => item.label || item.value).map(item => [item.label, item.value].filter(Boolean).join(': ')).join(' · ')}
        </p> : null}
      </div>
    </> : <p className="mt-4 text-sm text-muted">Noch kein abgeschlossenes Training für diese Übung.</p>}
  </ModalShell>;
}
