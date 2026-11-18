import { useEffect, useState } from 'react';
import { useAppData } from './AppProvider';
import { checkAppRelease, createAppUpdateUrl } from '../utils/appUpdates';
export default function AppUpdateNotice() {
  const { flushState } = useAppData();
  const [available, setAvailable] = useState(null);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || import.meta.env.MODE === 'android') return undefined;
    const current = __APP_RELEASE__;
    let disposed = false, checking = false, request;
    const check = async () => {
      if (document.hidden || checking) return;
      checking = true;
      request = new AbortController();
      const timeout = window.setTimeout(() => request.abort(), 8000);
      try {
        const entry = document.querySelector('script[type="module"][src]');
        const baseUrl = entry ? new URL('../', entry.src).href : new URL(import.meta.env.BASE_URL, document.baseURI).href;
        const release = await checkAppRelease(current, { baseUrl, signal: request.signal });
        if (!disposed && release) setAvailable(release);
      } catch { /* Offline/deployment transitions must not interrupt training. */ }
      finally { window.clearTimeout(timeout); checking = false; }
    };
    check();
    const timer = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', check);
    return () => { disposed = true; request?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('pageshow', check); };
  }, []);
  if (!available) return null;
  return (
    <aside className="shrink-0 border-b border-amber/40 bg-amber-soft px-3 py-2 text-sm text-ink" role="status">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>Neue Version {available.version} verfügbar.</span>
        <button className="secondary-button" type="button" onClick={() => {
          if (!flushState()) { setSaveError(true); return; }
          window.location.replace(createAppUpdateUrl(window.location.href, available));
        }}>Aktualisieren</button>
        {saveError ? <p className="w-full text-xs">Deine Daten konnten nicht gespeichert werden. Bitte zuerst exportieren.</p> : null}
      </div>
    </aside>
  );
}
