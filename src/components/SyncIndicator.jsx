import { useAppData } from './AppProvider';
import { formatDateTime } from '../utils/date';

const statusStyles = {
  offline: 'bg-ember/15 text-ember',
  ready: 'bg-ink/10 text-ink',
  syncing: 'bg-sunrise/20 text-ember',
  synced: 'bg-pine/15 text-pine',
  error: 'bg-ember/15 text-ember',
};

export default function SyncIndicator() {
  const { syncState, state } = useAppData();

  return (
    <div className="panel min-w-[260px] self-start p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-ink">Sync</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[syncState.status]}`}>
          {syncState.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink/75">{syncState.message}</p>
      <p className="mt-2 text-xs text-ink/55">Letzter Lauf: {formatDateTime(state.meta.lastSyncAt)}</p>
    </div>
  );
}
