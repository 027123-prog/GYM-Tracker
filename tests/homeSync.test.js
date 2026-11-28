import assert from 'node:assert/strict';
import test from 'node:test';
import { syncHome } from '../src/utils/homeSync.js';
import { normalizeAppState } from '../src/utils/storage.js';

const serverId = 'test-home';
const data = () => ({ exercises: [], templates: [], maxStrengthRecords: [], workouts: [{ id: 'a', name: 'A', exercises: [] }] });
function device(local, remote, ancestor) {
  const env = { local, remote, checkpoint: ancestor, writes: 0, reads: [] };
  env.run = options => syncHome({
    knownServer: serverId,
    getLocal: () => env.local,
    applyLocal: state => { env.local = state; },
    readCheckpoint: async () => env.checkpoint,
    saveCheckpoint: async value => { env.checkpoint = value; },
    active: () => true,
    request: async (method, condition, body) => {
      if (method === 'GET') {
        env.reads.push(condition);
        return condition === env.remote.revision ? { status: 304 } : { status: 200, data: structuredClone(env.remote) };
      }
      env.writes++;
      env.beforeWrite?.();
      if (body.revision !== env.remote.revision) return { status: 409 };
      env.remote = { serverId, revision: body.revision + 1, state: structuredClone(body.state) };
      if (env.loseReply) { env.loseReply = false; throw new Error('offline'); }
      return { status: 200, data: { serverId, revision: env.remote.revision } };
    },
    ...options,
  });
  return env;
}
const rev = (revision, state) => ({ serverId, revision, state });

test('untouched installation does not seed the PC and an existing workout is adopted automatically', async () => {
  const d = device(normalizeAppState(), rev(0, null));
  assert.equal((await d.run()).status, 'idle');
  assert.equal(d.writes, 0);
  d.remote = rev(1, data());
  assert.equal((await d.run()).status, 'ok');
  assert.deepEqual(d.local, data());
  assert.equal((await d.run()).status, 'ok');
  assert.deepEqual(d.reads, [undefined, undefined, 1]);
  assert.equal(d.writes, 0);
});

test('a lost reply can be retried after restart without duplicating the workout', async () => {
  const d = device(data(), rev(0, null));
  d.loseReply = true;
  await assert.rejects(d.run(), /offline/);
  assert.equal(d.checkpoint, undefined);
  assert.equal((await d.run()).status, 'ok');
  assert.deepEqual(d.checkpoint, rev(1, data()));
  assert.equal(d.writes, 1);
});

test('an edit during upload keeps the local edit and the PC additions', async () => {
  const base = data(), local = data(), other = data();
  local.workouts[0].name = 'Handy';
  other.workouts.push({ id: 'b', name: 'Vom PC', exercises: [] });
  const d = device(local, rev(2, other), rev(1, base));
  d.beforeWrite = () => { d.beforeWrite = null; d.local = structuredClone(d.local); d.local.workouts[0].name = 'Neue Eingabe'; };
  assert.equal((await d.run()).status, 'retry');
  assert.equal(d.checkpoint.uploaded, true);
  assert.equal((await d.run()).status, 'ok');
  assert.deepEqual(d.local.workouts.map(w => w.name), ['Neue Eingabe', 'Vom PC']);
  assert.deepEqual(d.local, d.remote.state);
  assert.deepEqual(d.checkpoint, d.remote);
});

test('server changes between read and write trigger a fresh merge before overwriting anything', async () => {
  const base = data(), local = data();
  local.workouts[0].name = 'Handy';
  const d = device(local, rev(1, base), rev(1, base));
  d.beforeWrite = () => {
    d.beforeWrite = null;
    const other = data();
    other.workouts[0].notes = 'PC';
    d.remote = rev(2, other);
  };
  assert.equal((await d.run()).status, 'retry');
  assert.equal(d.checkpoint.revision, 1);
  assert.equal((await d.run()).status, 'ok');
  assert.equal(d.local.workouts[0].notes, 'PC');
  assert.equal(d.local.workouts[0].name, 'Handy');
});

test('conflict choices apply only to the reviewed revision and values', async () => {
  const base = data(), local = data(), other = data();
  local.workouts[0].name = 'Handy';
  other.workouts[0].name = 'PC';
  const d = device(local, rev(2, other), rev(1, base));
  const c = await d.run();
  assert.equal(c.status, 'conflict');
  assert.equal(d.writes, 0);
  d.remote = rev(3, other);
  assert.equal((await d.run({ choice: { ...c, prefer: 'local' } })).status, 'conflict');
  const current = await d.run();
  assert.equal((await d.run({ choice: { ...current, prefer: 'remote' } })).status, 'ok');
  assert.equal(d.local.workouts[0].name, 'PC');
  assert.equal(d.writes, 0);
});

test('no data is sent when local storage reports corruption', async () => {
  const d = device({ ...data(), meta: { storageError: 'blocked' } }, rev(1, data()));
  await assert.rejects(d.run(), /Speicherfehler/);
  assert.equal(d.writes, 0);
});
