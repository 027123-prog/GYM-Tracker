import { useEffect, useState } from 'react';
import { useAppData } from './AppProvider';

const messages = {
  checking: 'Suche nach Updates …',
  current: 'HardGainWAF ist auf dem neuesten Stand.',
  none: 'Für Android ist noch kein Update veröffentlicht.',
  downloading: 'Update wird heruntergeladen …',
  confirming: 'Bestätige die Installation im Android-Dialog.',
  permission: 'Erlaube HardGainWAF unter Android das Installieren von Apps. Tippe danach erneut auf „Update installieren“.',
  offline: 'GitHub war nicht erreichbar. Versuche es erneut, wenn du online bist.',
  invalid: 'Die Update-Datei hat die Prüfung nicht bestanden.',
  error: 'Das Update konnte nicht vorbereitet werden. Versuche es erneut.',
  saveError: 'Dein Training konnte nicht gespeichert werden. Exportiere zuerst deine Daten.',
};

export default function AndroidUpdateControl() {
  const { flushState } = useAppData();
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState('');
  const busy = status === 'checking' || status === 'downloading';

  useEffect(() => {
    function handleUpdate(event) {
      setStatus(event.detail.status);
      setVersion(event.detail.version);
    }
    window.addEventListener('hardgain-android-update', handleUpdate);
    return () => window.removeEventListener('hardgain-android-update', handleUpdate);
  }, []);

  function check() {
    if (!window.HardGainAndroid) {
      setStatus('error');
      return;
    }
    setVersion('');
    setStatus('checking');
    window.HardGainAndroid.checkForUpdate();
  }

  function install() {
    if (!flushState()) {
      setStatus('saveError');
      return;
    }
    setStatus('downloading');
    window.HardGainAndroid.installUpdate();
  }

  return (
    <div className="mt-5 grid gap-2 border-t border-line pt-4">
      <button type="button" className="secondary-button w-full" disabled={busy} onClick={check}>
        Nach Updates suchen
      </button>
      {status && (
        <p role="status" className="text-sm text-ink">
          {status === 'available' ? `Version ${version} ist verfügbar.` : messages[status]}
        </p>
      )}
      {version && !busy && (
        <button type="button" className="action-button w-full" onClick={install}>
          Update installieren
        </button>
      )}
    </div>
  );
}
