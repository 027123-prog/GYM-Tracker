import ModalShell from './ModalShell';

export default function WorkoutModeModal({ isOpen, onChoose, onClose }) {
  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="workout-mode" maxWidth="max-w-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 id="workout-mode" className="font-display text-xl font-bold text-ink">Wie möchtest du trainieren?</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">×</button>
      </div>
      <div className="mt-4 grid gap-2">
        <button type="button" className="secondary-button flex-col !items-start !py-3 text-left" onClick={() => onChoose(true)}>
          <strong>Geführt</strong><span className="text-xs font-normal text-muted">Mit Satzzielen und vorsichtiger Steigerung</span>
        </button>
        <button type="button" className="secondary-button flex-col !items-start !py-3 text-left" onClick={() => onChoose(false)}>
          <strong>Frei</strong><span className="text-xs font-normal text-muted">Vorlage öffnen und Sätze frei eintragen</span>
        </button>
      </div>
    </ModalShell>
  );
}
