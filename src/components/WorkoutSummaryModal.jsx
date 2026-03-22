export default function WorkoutSummaryModal({ isOpen, summary, onClose, onGoDashboard }) {
  if (!isOpen || !summary) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
      <div className="panel w-full max-w-xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine/70">Workout Summary</p>
        <h3 className="mt-3 font-display text-3xl font-semibold text-ink">{summary.name}</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Volumen</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{summary.totalVolume.toFixed(0)} kg</p>
          </div>
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Übungen</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{summary.exerciseCount}</p>
          </div>
          <div className="rounded-3xl bg-paper p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Sätze</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{summary.setCount}</p>
          </div>
        </div>
        <p className="mt-5 text-sm text-ink/70">
          Die Session ist lokal gespeichert. Sobald Internet verfügbar ist, springt der GitHub-Sync-Platzhalter an.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="secondary-button">
            Weiter bearbeiten
          </button>
          <button type="button" onClick={onGoDashboard} className="action-button">
            Zum Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
