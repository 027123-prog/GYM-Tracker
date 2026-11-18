import { useEffect, useRef, useState } from 'react';
import { createBackupPayload, createLocalRecoveryPoint, parseBackupPayload } from '../utils/storage';
import { TRAINING_PLAN_FORMAT, applyTrainingPlanImport, parseTrainingPlanImport } from '../utils/trainingPlanImport';
import { useAppData } from './AppProvider';

function createBackupFilename(prefix = 'hardgainwaf-backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

export default function BackupControls() {
  const { state, importBackup, importTrainingPlans } = useAppData();
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (import.meta.env.MODE !== 'android') return undefined;
    function handleExportResult(event) {
      setStatus({
        saved: 'Exportiert',
        cancelled: 'Export abgebrochen',
        error: 'Export fehlgeschlagen',
      }[event.detail] ?? '');
    }
    window.addEventListener('hardgain-backup-export', handleExportResult);
    return () => window.removeEventListener('hardgain-backup-export', handleExportResult);
  }, []);

  function handleExport() {
    const json = JSON.stringify(createBackupPayload(state), null, 2);
    const filename = createBackupFilename();
    if (import.meta.env.MODE === 'android') {
      if (window.HardGainAndroid) window.HardGainAndroid.saveBackup(filename, json);
      else setStatus('Export fehlgeschlagen');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
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
      const payload = JSON.parse(rawText);
      if (payload?.format === TRAINING_PLAN_FORMAT) {
        const plans = parseTrainingPlanImport(payload);
        applyTrainingPlanImport(state, payload);
        const shouldImportPlans = window.confirm(
          `Diese Trainingspläne übernehmen?\n\n${plans.templates.map(plan => plan.name).join('\n')}\n\nVorhandene Versionen dieser Pläne werden aktualisiert. Workouts, Satzwerte und vorhandene Geräteeinstellungen bleiben erhalten. Der bisherige Stand wird lokal gesichert.`,
        );
        if (!shouldImportPlans) { setStatus('Import abgebrochen'); return; }
        createLocalRecoveryPoint(state);
        importTrainingPlans(payload);
        setStatus(`${plans.templates.length} Trainingspläne importiert`);
        return;
      }
      const importedState = parseBackupPayload(rawText);
      const shouldImport = window.confirm(
        `Aktuellen Datenstand ersetzen?\n\n${importedState.workouts.length} Workouts\n${importedState.exercises.length} Übungen\n${importedState.templates.length} Vorlagen\n\nDer bisherige Stand wird lokal als Rücksetzpunkt gesichert.`,
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
        Export
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button">
        Import
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
