import ModalShell from './ModalShell';

export default function WorkoutSummaryModal({ isOpen, summary, onClose, onGoDashboard }) {
  if (!summary) {
    return null;
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="workout-summary-title" maxWidth="max-w-xl">
      <p className="eyebrow">Workout abgeschlossen</p>
      <h2 id="workout-summary-title" className="mt-2 font-display text-3xl font-bold text-ink">
        {summary.name}
      </h2>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="metric px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Volumen</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">{summary.totalVolume.toFixed(0)}</p>
          <p className="text-[10px] text-muted">kg</p>
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
      <p className="mt-4 rounded-sm border border-sage/25 bg-mist px-3 py-2 text-sm text-sage">
        Lokal gespeichert. Exportiere regelmäßig eine Sicherung für ein zweites Gerät.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="secondary-button">
          Weiter bearbeiten
        </button>
        <button type="button" onClick={onGoDashboard} className="action-button">
          Zur Übersicht
        </button>
      </div>
    </ModalShell>
  );
}
