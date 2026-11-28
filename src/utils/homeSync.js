import { homeValuesEqual, isFactoryHomeState, mergeHomeState } from './homeSyncMerge';

const collections = ['exercises', 'templates', 'workouts', 'maxStrengthRecords'];

function checkStatus(response) {
  if (response.status === 401 || response.status === 403) {
    throw new Error('Zugang abgelehnt. Bitte die Verbindung in den Einstellungen prüfen.');
  }
  if (response.status === 413) throw new Error('Der Trainingsstand ist für den Abgleich zu groß.');
  if (response.status !== 200) throw new Error('PC nicht erreichbar. Änderungen bleiben auf diesem Gerät.');
  return response.data;
}

// The server accepts a write only at the revision that supplied its merge input.
// The saved common ancestor moves only after the merged state is durable locally.
export async function syncHome({ request, readCheckpoint, saveCheckpoint, getLocal, applyLocal, knownServer, choice, active }) {
  let checkpoint = knownServer && await readCheckpoint(knownServer);
  const pull = await request('GET', checkpoint?.uploaded ? undefined : checkpoint?.revision);
  let remote;
  if (pull.status === 304 && checkpoint) {
    remote = checkpoint;
  } else {
    remote = checkStatus(pull);
    if (typeof remote?.serverId !== 'string' || !Number.isSafeInteger(remote.revision) || remote.revision < 0
      || (remote.state !== null && !collections.every(key => Array.isArray(remote.state?.[key])))) {
      throw new Error('Der PC hat einen ungültigen Trainingsstand gesendet.');
    }
    if (checkpoint?.serverId !== remote.serverId) checkpoint = await readCheckpoint(remote.serverId);
  }
  if (!active()) return { status: 'retry' };
  const captured = getLocal();
  if (captured.meta?.storageError) throw new Error('Abgleich pausiert. Bitte zuerst den lokalen Speicherfehler beheben.');
  // Send only plain data, just as in a JSON backup; optional undefined React fields stay local.
  const local = JSON.parse(JSON.stringify(captured));
  if (remote.state === null && !checkpoint && isFactoryHomeState(local)) {
    return { status: 'idle', serverId: remote.serverId };
  }
  const base = checkpoint?.state ?? null;
  const sameVersion = checkpoint && !checkpoint.uploaded && checkpoint.revision === remote.revision;
  const matchesChoice = choice && choice.serverId === remote.serverId && choice.revision === remote.revision
    && homeValuesEqual(choice.local, local);
  const merged = sameVersion ? { state: local, conflicts: [] }
    : mergeHomeState(base, local, remote.state, matchesChoice ? { prefer: choice.prefer } : {});
  if (merged.conflicts.length && !matchesChoice) {
    return { status: 'conflict', conflicts: merged.conflicts, local, serverId: remote.serverId, revision: remote.revision };
  }
  let revision = remote.revision;
  if (!homeValuesEqual(remote.state, merged.state)) {
    const put = await request('PUT', undefined, { serverId: remote.serverId, revision, state: merged.state });
    if (put.status === 409) return { status: 'retry' };
    const saved = checkStatus(put);
    if (saved?.serverId !== remote.serverId || !Number.isSafeInteger(saved.revision) || saved.revision < revision) {
      throw new Error('Der PC hat die Speicherung nicht bestätigt.');
    }
    revision = saved.revision;
  }
  if (!active()) return { status: 'retry' };
  if (captured !== getLocal()) {
    // A new edit arrived while the PC was saving. Its ancestor is the local snapshot sent,
    // which can still differ from the committed merge by independent edits on the PC.
    await saveCheckpoint({ serverId: remote.serverId, revision, state: local, uploaded: true });
    return { status: 'retry' };
  }
  if (!homeValuesEqual(local, merged.state)) applyLocal(merged.state);
  if (!checkpoint || checkpoint.uploaded || revision !== checkpoint.revision || !homeValuesEqual(checkpoint.state, merged.state)) {
    await saveCheckpoint({ serverId: remote.serverId, revision, state: merged.state });
  }
  return { status: 'ok', serverId: remote.serverId };
}
