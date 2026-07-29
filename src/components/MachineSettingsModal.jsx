import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';

function createEmptyRow(index) {
  return {
    id: `row-${index}-${Date.now()}`,
    label: '',
    value: '',
  };
}

export default function MachineSettingsModal({ isOpen, exerciseName, initialSettings, onClose, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setRows(initialSettings?.length ? initialSettings : [createEmptyRow(0)]);
  }, [initialSettings, isOpen]);

  function updateRow(id, field, value) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, createEmptyRow(current.length)]);
  }

  function removeRow(id) {
    setRows((current) => (current.length === 1 ? [createEmptyRow(0)] : current.filter((row) => row.id !== id)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(rows);
    onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="machine-settings-title" maxWidth="max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Maschinen-Setup</p>
            <h2 id="machine-settings-title" className="mt-2 font-display text-2xl font-bold text-ink">
              {exerciseName}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-sm border border-line bg-paper/50 p-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="field"
                  value={row.label}
                  onChange={(event) => updateRow(row.id, 'label', event.target.value)}
                  placeholder="z. B. Sitzhöhe"
                  aria-label="Bezeichnung der Maschineneinstellung"
                />
                <input
                  className="field"
                  value={row.value}
                  onChange={(event) => updateRow(row.id, 'value', event.target.value)}
                  placeholder="z. B. 6"
                  aria-label="Wert der Maschineneinstellung"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="danger-button"
                  aria-label="Einstellungszeile entfernen"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <button type="button" onClick={addRow} className="secondary-button">
              Zeile hinzufügen
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="secondary-button">
                Abbrechen
              </button>
              <button type="submit" className="action-button">
                Speichern
              </button>
            </div>
          </div>
        </form>
    </ModalShell>
  );
}
