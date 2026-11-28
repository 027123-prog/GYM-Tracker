import { useCallback, useEffect, useRef, useState } from 'react';
import { syncHome } from '../utils/homeSync';
import { homeValuesEqual } from '../utils/homeSyncMerge';
import { readCheckpoint, saveCheckpoint } from '../utils/homeSyncCheckpoint';
import { androidPairing, homeDevice, pairPhone, stateRequest } from '../utils/homeSyncTransport';
import { normalizeAppState, saveAppState } from '../utils/storage';

export default function useHomeSync(state, stateRef, setState) {
  const [device] = useState(homeDevice);
  const [pairing, setPairing] = useState(() => device === 'android' ? androidPairing() : {});
  const [report, setReport] = useState({ status: 'idle' });
  const enabled = device === 'pc' || (device === 'android' && pairing.paired);
  const knownServer = useRef(null);
  const checkpoint = useRef(null);
  const generation = useRef(0);
  const running = useRef(false);
  const timer = useRef(null);
  const pass = useRef(null);
  const resolution = useRef(null);
  const conflict = useRef(null);

  const lastMirror = useRef(null);
  const mirror = useCallback(() => {
    const base = checkpoint.current;
    if (device === 'android' && pairing.paired && !base?.uploaded && base?.serverId === pairing.serverId && window.HardGainAndroid.homeSyncQueue) {
      const local = stateRef.current;
      if (local.meta?.storageError || (lastMirror.current?.revision === base.revision && lastMirror.current?.serverId === base.serverId && lastMirror.current?.local === local)) return;
      const baseJson = JSON.stringify(base.state);
      window.HardGainAndroid.homeSyncQueue(base.serverId, String(base.revision), baseJson, homeValuesEqual(local, base.state) ? baseJson : JSON.stringify(local));
      lastMirror.current = { revision: base.revision, serverId: base.serverId, local };
    }
  }, [device, pairing.paired, pairing.serverId, stateRef]);

  const schedule = useCallback((delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pass.current?.(), delay);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const epoch = ++generation.current;
    const current = () => epoch === generation.current;
    const read = async id => {
      const result = await readCheckpoint(id);
      if (current() && result) checkpoint.current = result;
      if (device === 'android' && result && !result.uploaded && window.HardGainAndroid.homeSyncBackgroundReceipt) {
        const receipt = JSON.parse(window.HardGainAndroid.homeSyncBackgroundReceipt() || 'null');
        if (receipt?.serverId === id && Number(receipt.baseRevision) === result.revision && Number(receipt.revision) > result.revision) {
          return { ...result, state: receipt.localState, uploaded: true };
        }
      }
      return result;
    };
    const persist = async value => {
      await saveCheckpoint(value);
      if (current()) checkpoint.current = value;
    };
    if (pairing.serverId) read(pairing.serverId).then(() => { if (current()) mirror(); }).catch(() => {});
    async function exchange() {
      if (!current()) return;
      const choice = resolution.current;
      resolution.current = null;
      const result = await syncHome({
        request: (...args) => stateRequest(device, ...args), readCheckpoint: read, saveCheckpoint: persist,
        getLocal: () => stateRef.current, knownServer: knownServer.current, choice, active: current,
        applyLocal: data => {
          const normalized = normalizeAppState(data);
          saveAppState(normalized);
          stateRef.current = normalized;
          setState(normalized);
        },
      });
      if (!current()) return;
      if (result.status === 'retry') { knownServer.current = null; schedule(200); return; }
      knownServer.current = result.serverId;
      conflict.current = result.status === 'conflict' ? result : null;
      setReport({ status: result.status, conflicts: result.conflicts, at: new Date().toISOString() });
      if (result.status === 'ok') mirror();
    }
    async function run() {
      if (running.current) { schedule(400); return; }
      if (document.visibilityState === 'hidden') return;
      running.current = true;
      try {
        if (navigator.locks) await navigator.locks.request('hardgainwaf-home-sync', exchange);
        else await exchange();
      } catch (error) {
        if (current()) setReport({ status: 'offline', message: error instanceof TypeError || error.name === 'TimeoutError'
          ? 'PC nicht erreichbar. Änderungen bleiben auf diesem Gerät.' : error.message || 'PC nicht erreichbar.' });
      } finally { running.current = false; }
    }
    pass.current = run;
    const wake = () => {
      if (document.visibilityState === 'hidden') { mirror(); return; }
      // First request after reconnect identifies the server even after a restore.
      knownServer.current = null;
      schedule(80);
    };
    const periodic = setInterval(() => schedule(), 20000);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    schedule(100);
    return () => {
      generation.current++;
      pass.current = null;
      clearInterval(periodic);
      clearTimeout(timer.current);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [enabled, device, pairing.serverId, mirror, schedule, setState, stateRef]);

  useEffect(() => {
    if (!enabled) return;
    mirror();
    schedule(650);
  }, [state, enabled, schedule, mirror]);

  useEffect(() => {
    if (device !== 'android') return;
    const receive = () => setPairing(androidPairing());
    window.addEventListener('hardgain-home-sync-link', receive);
    return () => window.removeEventListener('hardgain-home-sync-link', receive);
  }, [device]);

  async function pair(link) {
    const reply = await pairPhone(link);
    if (reply.status !== 200 && reply.status !== 201) {
      throw new Error(reply.status === 400 || reply.status === 401 || reply.status === 403 || reply.status === 410
        ? 'Kopplungslink ungültig oder abgelaufen. Am PC einen neuen Code anzeigen.'
        : 'Der PC ist nicht erreichbar. WLAN und laufenden PC prüfen.');
    }
    knownServer.current = null;
    checkpoint.current = null;
    conflict.current = null;
    setPairing(androidPairing());
    schedule();
  }

  function dismissLink() {
    window.HardGainAndroid.homeSyncDismissLink();
    setPairing(androidPairing());
  }

  function forget() {
    generation.current++;
    window.HardGainAndroid.homeSyncForget();
    lastMirror.current = null;
    knownServer.current = null;
    checkpoint.current = null;
    conflict.current = null;
    setPairing(androidPairing());
    setReport({ status: 'idle' });
  }

  function resolveConflict(prefer) {
    if (!conflict.current) return;
    resolution.current = { ...conflict.current, prefer };
    schedule();
  }
  return { device, pairing, report, pair, forget, dismissLink, resolveConflict, refresh: schedule };
}
