export const pcOrigin = 'http://127.0.0.1:4175';

export function homeDevice() {
  if (typeof window.HardGainAndroid?.homeSyncStatus === 'function') return 'android';
  return location.origin === pcOrigin ? 'pc' : null;
}

export function androidPairing() {
  try { return JSON.parse(window.HardGainAndroid.homeSyncStatus()); }
  catch { return { paired: false }; }
}

export async function pcRequest(path, method = 'GET', revision, body) {
  const headers = { 'X-HardGain-Sync': '1' };
  if (method === 'GET' && revision != null) headers['If-None-Match'] = '"' + revision + '"';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/home-sync/' + path, {
    method, headers, cache: 'no-store', redirect: 'error', credentials: 'omit',
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, data: response.status === 304 ? null : await response.json() };
}

function nativeRequest(start) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    function remove() {
      clearTimeout(timer);
      window.removeEventListener('hardgain-home-sync-response', receive);
    }
    function receive(event) {
      if (event.detail?.id !== id) return;
      remove();
      try { resolve({ status: event.detail.status, data: event.detail.body ? JSON.parse(event.detail.body) : null }); }
      catch { reject(new Error('Ungültige Antwort vom PC.')); }
    }
    const timer = setTimeout(() => { remove(); reject(new Error('PC nicht erreichbar.')); }, 45000);
    window.addEventListener('hardgain-home-sync-response', receive);
    try { start(id); } catch (error) { remove(); reject(error); }
  });
}

export function pairPhone(link) {
  return nativeRequest(id => window.HardGainAndroid.homeSyncPair(id, link.trim()));
}

export function stateRequest(device, method, revision, body) {
  if (device === 'pc') return pcRequest('state', method, revision, body);
  return nativeRequest(id => window.HardGainAndroid.homeSyncRequest(
    id, method, revision == null ? '' : String(revision), body === undefined ? '' : JSON.stringify(body),
  ));
}
