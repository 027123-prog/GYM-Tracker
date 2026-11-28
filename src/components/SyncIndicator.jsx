import { useAppData } from './AppProvider';
const statusStyles = {
  saving: 'text-amber-deep',
  saved: 'text-sage',
  error: 'text-ember',
};

export default function SyncIndicator({ compact = false }) {
  const { syncState, homeSync } = useAppData();
  const error = syncState.status === 'error';
  const savedTime = syncState.savedAt
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(syncState.savedAt))
    : '';

  if (!error && homeSync.report.status === 'conflict') {
    return <button type="button" className="text-xs font-semibold text-amber-deep" onClick={() => window.dispatchEvent(new Event('hardgain-open-settings'))}>WLAN-Konflikt klären</button>;
  }
  const homeStatus = homeSync.report.status === 'ok' ? ' · Im Heim-WLAN abgeglichen' : '';
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${syncState.message}${savedTime ? ` · ${savedTime}` : ''}${homeStatus}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          syncState.status === 'error' ? 'bg-ember' : syncState.status === 'saving' ? 'bg-amber' : 'bg-sage'
        }`}
      />
      <span className={compact && !error ? 'sr-only' : `text-[11px] font-semibold ${statusStyles[syncState.status] ?? 'text-muted'}`}>
        {error ? 'Speicherfehler' : syncState.message}
      </span>
      {!compact && savedTime ? <span className="text-[11px] text-muted">{savedTime}</span> : null}
    </div>
  );
}
