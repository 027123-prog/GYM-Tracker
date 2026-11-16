const validVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
export function getAvailableRelease(candidate, current) {
  if (candidate?.schemaVersion !== 1 || !validVersion(candidate.version)
    || typeof candidate.buildId !== 'string' || !/^[a-z0-9.-]{1,80}$/.test(candidate.buildId)
    || !Number.isFinite(candidate.builtAt) || candidate.builtAt <= 0 || !current
    || candidate.buildId === current.buildId) return null;
  const incoming = candidate.version.split('.').map(Number);
  const installed = current.version.split('.').map(Number);
  const difference = incoming.map((number, index) => number - installed[index]).find(number => number !== 0) || 0;
  if (difference < 0 || (difference === 0 && candidate.builtAt <= current.builtAt)) return null;
  return { version: candidate.version, buildId: candidate.buildId, builtAt: candidate.builtAt };
}
export function createAppUpdateUrl(href, release) {
  if (!release || !/^[a-z0-9.-]{1,80}$/.test(release.buildId)) throw new Error('Ungültige Appversion');
  const url = new URL(href);
  url.searchParams.set('_hg_version', release.buildId);
  return url.href;
}
export function clearAppliedUpdateToken(href, buildId) {
  const url = new URL(href);
  if (url.searchParams.get('_hg_version') !== buildId) return null;
  url.searchParams.delete('_hg_version');
  return url.href;
}
export async function checkAppRelease(current, { baseUrl, fetcher = fetch, now = Date.now(), signal } = {}) {
  const url = new URL('version.json', baseUrl);
  url.searchParams.set('check', String(now));
  const response = await fetcher(url.href, { cache: 'no-store', signal, credentials: 'omit' });
  if (!response.ok) return null;
  return getAvailableRelease(await response.json(), current);
}
