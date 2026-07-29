import { useRef, useState } from 'react';
import { createBackupPayload, createLocalRecoveryPoint, parseBackupPayload } from '../utils/storage';
import { useAppData } from './AppProvider';

function createBackupFilename(prefix = 'hardgainwaf-backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

export default function BackupControls({ compact = false }) {
  const { state, importBackup } = useAppData();
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('');

  function handleExport() {
    const payload = createBackupPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = createBackupFilename();
    link.click();

    window.URL.revokeObjectURL(url);
    setStatus('Exportiert');
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const importedState = parseBackupPayload(rawText);
      const shouldImport = window.confirm(
        `Sicherung importieren?\n\n${importedState.workouts.length} Workouts\n${importedState.exercises.length} Übungen\n${importedState.templates.length} Vorlagen\n\nDer aktuelle Stand wird vorher als lokaler Rücksetzpunkt gespeichert.`,
      );

      if (!shouldImport) {
        setStatus('Import abgebrochen');
        return;
      }

      createLocalRecoveryPoint(state);
      importBackup(importedState);
      setStatus('Importiert');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import fehlgeschlagen');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleExport} className="secondary-button">
        {compact ? 'Export' : 'Daten exportieren'}
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button">
        {compact ? 'Import' : 'Daten importieren'}
      </button>
      {status ? (
        <span className="max-w-xs text-xs font-medium text-amber-deep" role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
