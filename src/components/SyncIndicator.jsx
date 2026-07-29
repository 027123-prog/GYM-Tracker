import { useAppData } from './AppProvider';
const statusStyles = {
  saving: 'text-amber-deep',
  saved: 'text-sage',
  error: 'text-ember',
};

export default function SyncIndicator({ compact = false }) {
  const { syncState } = useAppData();
  const savedTime = syncState.savedAt
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(syncState.savedAt))
    : '';

  return (
    <div
      className={`flex items-center gap-1.5 ${compact ? 'self-start' : ''}`}
      title={`${syncState.message}${savedTime ? ` · ${savedTime}` : ''}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          syncState.status === 'error' ? 'bg-ember' : syncState.status === 'saving' ? 'bg-amber' : 'bg-sage'
        }`}
      />
      <span className={`text-[11px] font-semibold ${statusStyles[syncState.status] ?? 'text-muted'}`}>
        {syncState.status === 'error' ? 'Speicherfehler' : 'Lokal'}
      </span>
      {!compact && savedTime ? <span className="text-[11px] text-muted">{savedTime}</span> : null}
    </div>
  );
}
