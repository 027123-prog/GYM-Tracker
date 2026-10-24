import ModalShell from './ModalShell';
import { getWorkoutLoadMetrics } from '../utils/workoutPresentation';

export default function WorkoutSummaryModal({ isOpen, summary, onClose, onGoDashboard }) {
  if (!summary) {
    return null;
  }
  const { primary, additional } = getWorkoutLoadMetrics(summary);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="workout-summary-title" maxWidth="max-w-xl">
      <p className="eyebrow">Workout abgeschlossen</p>
      <h2 id="workout-summary-title" className="mt-2 font-display text-3xl font-bold text-ink">
        {summary.name}
      </h2>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="metric px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{primary.label}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{primary.display}</p>
          {primary.unit ? <p className="text-[10px] text-muted">{primary.unit}</p> : null}
        </div>
        <div className="metric px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Übungen</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{summary.exerciseCount}</p>
        </div>
        <div className="metric px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Sätze</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{summary.setCount}</p>
        </div>
      </div>
      {additional ? <p className="mt-3 text-sm text-muted">{additional}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="secondary-button">
          Bearbeiten
        </button>
        <button type="button" onClick={onGoDashboard} className="action-button">
          Übersicht
        </button>
      </div>
    </ModalShell>
  );
}
