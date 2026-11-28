import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createSyncApi } from '../scripts/home-sync-server.mjs';
import { normalizeAppState } from '../src/utils/storage.js';

const pcHeaders = { host: '127.0.0.1:4175', 'x-hardgain-sync': '1' };
const fakePeer = () => ({ host: '192.168.1.2', pin: '0'.repeat(64) });

function fixture(t, peer = fakePeer) {
  const folder = mkdtempSync(join(tmpdir(), 'gym-home-sync-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return { folder, api: createSyncApi(folder, peer) };
}

function call(api, { path = 'state', method = 'GET', headers = {}, remote = false, data } = {}) {
  return new Promise(resolve => {
    const req = Readable.from(data === undefined ? [] : [Buffer.from(JSON.stringify(data))]);
    req.url = '/api/home-sync/' + path;
    req.method = method;
    req.headers = { ...(remote ? {} : pcHeaders), 'content-type': 'application/json', ...headers };
    const result = {};
    api(req, {
      writeHead(status, responseHeaders) { Object.assign(result, { status, headers: responseHeaders }); },
      end(raw) { resolve({ ...result, data: raw ? JSON.parse(raw) : null }); },
    }, remote);
  });
}

function state() {
  return { workouts: [{ id: 'a', name: 'A', exercises: [] }], exercises: [], templates: [], maxStrengthRecords: [] };
}

async function pair(api) {
  const issued = await call(api, { path: 'pairing', method: 'POST' });
  assert.equal(issued.status, 200);
  const link = new URL(issued.data.link);
  assert.equal(link.protocol, 'hardgainwaf:');
  assert.equal(link.hostname, 'pair');
  assert.equal(link.searchParams.get('host'), '192.168.1.2');
  assert.equal(link.searchParams.get('port'), '4176');
  assert.equal(link.searchParams.get('pin'), fakePeer().pin);
  const code = link.searchParams.get('code');
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(issued.data.expiresAt) > Date.now());
  const redeem = { path: 'pair', method: 'POST', data: { code }, remote: true };
  const result = await call(api, redeem);
  assert.equal(result.status, 200);
  assert.match(result.data.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await call(api, redeem)).status, 403);
  return { token: result.data.token, serverId: result.data.serverId };
}

test('one-time LAN pairing, loopback origin and persisted device authorization', async t => {
  const { folder, api } = fixture(t);
  assert.equal((await call(api, { headers: { origin: 'https://unrelated.invalid' } })).status, 403);
  assert.equal((await call(api, { headers: { 'x-hardgain-sync': '' } })).status, 403);
  assert.equal((await call(api, { headers: { host: 'localhost:4175' } })).status, 403);
  assert.equal((await call(api, { path: 'pairing', method: 'POST', remote: true })).status, 401);
  assert.equal((await call(api, { remote: true })).status, 401);
  const first = await call(api);
  assert.equal(first.status, 200);
  assert.equal(first.data.state, null);
  assert.equal(first.data.revision, 0);
  const { serverId, token } = await pair(api);
  assert.equal(serverId, first.data.serverId);
  const restored = createSyncApi(folder, () => null);
  const headers = { authorization: 'Bearer ' + token };
  assert.equal((await call(restored, { remote: true, headers })).status, 200);
  assert.equal((await call(restored, { remote: true, headers: { ...headers, origin: 'null' } })).status, 403);
  assert.equal((await call(restored, { path: 'pairing', method: 'POST' })).status, 503);
  assert.ok(!readFileSync(join(folder, 'devices.json'), 'utf8').includes(token));
});

test('atomic revisions, backups, restart, cache validation and rejected input', async t => {
  const { folder, api } = fixture(t);
  const write = (revision, state) => call(api, { method: 'PUT', data: { revision, state } });
  const base = normalizeAppState();
  assert.equal((await write(0, base)).status, 200);
  const one = structuredClone(base), two = structuredClone(base);
  one.workouts.unshift({ id: 'one', exercises: [] });
  two.workouts.unshift({ id: 'two', exercises: [] });
  const answers = await Promise.all([write(1, one), write(1, two)]);
  assert.deepEqual(answers.map(a => a.status).sort(), [200, 409]);
  const winner = answers[0].status === 200 ? one : two;
  const restored = createSyncApi(folder, fakePeer);
  const get = await call(restored);
  assert.deepEqual(get.data.state, JSON.parse(JSON.stringify(winner)));
  assert.equal(get.data.revision, 2);
  assert.equal(get.headers.ETag, '"2"');
  assert.equal((await call(restored, { headers: { 'if-none-match': '"2"' } })).status, 304);
  const backup = JSON.parse(readFileSync(join(folder, 'recovery', 'rev-000000000001.json')));
  assert.equal(backup.revision, 1);
  assert.deepEqual(backup.state, JSON.parse(JSON.stringify(base)));
  assert.equal((await write(2, { workouts: [] })).status, 400);
  assert.equal((await call(api, { method: 'PUT', headers: { 'content-length': String(33 * 1024 * 1024) } })).status, 413);
  assert.equal((await call(api, { method: 'PUT', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await write(2, winner)).data.revision, 2);
});

test('offline changes merge once and preserve concurrent PC edits and unresolved conflicts', async t => {
  const { folder, api } = fixture(t);
  const { serverId, token } = await pair(api);
  const base = state();
  const mobile = structuredClone(base);
  mobile.workouts.push({ id: 'b', name: 'B', exercises: [] });
  const pc = structuredClone(base);
  pc.workouts[0].name = 'Training A';
  for (const [revision, value] of [base, pc].entries()) {
    assert.equal((await call(api, { method: 'PUT', data: { revision, state: value } })).status, 200);
  }
  const reconcile = (overrides = {}, server = api) => call(server, {
    remote: true, path: 'reconcile', method: 'POST', headers: { authorization: 'Bearer ' + token },
    data: { serverId, baseRevision: 1, baseState: base, localState: mobile, ...overrides },
  });
  assert.deepEqual((await reconcile()).data, { serverId, revision: 3 });
  assert.equal((await reconcile()).data.revision, 3);
  const after = (await call(api)).data;
  assert.deepEqual(after.state.workouts.map(w => w.name), ['Training A', 'B']);
  mobile.workouts[0].name = 'Umbenannt';
  assert.equal((await reconcile()).status, 409);
  assert.equal((await reconcile({ serverId: 'wrong' })).status, 409);
  assert.equal((await reconcile({ baseRevision: 4 })).status, 409);
  assert.equal((await reconcile({ baseRevision: 0, baseState: base })).status, 400);
  assert.deepEqual((await call(api)).data, after);
  const invalidServer = await call(api, { method: 'PUT', data: { serverId: 'old', revision: 3, state: pc } });
  assert.equal(invalidServer.status, 409);
  // The PC deletes the item after Android sent it and lost the first reply.
  assert.equal((await call(api, { method: 'PUT', data: { serverId, revision: 3, state: pc } })).status, 200);
  mobile.workouts[0].name = 'A';
  const restarted = createSyncApi(folder, fakePeer);
  assert.deepEqual((await reconcile({}, restarted)).data, { serverId, revision: 3 });
  assert.deepEqual((await call(restarted)).data, { serverId, revision: 4, state: pc });
});

test('only the acknowledged device can continue from its offline projection after a PC edit', async t => {
  const { folder, api } = fixture(t);
  const { serverId, token } = await pair(api);
  const other = await pair(api);
  const base = state();
  const pc = structuredClone(base);
  pc.workouts[0].name = 'Training vom PC';
  pc.workouts.push({ id: 'pc', name: 'Weiterer PC-Eintrag', exercises: [] });
  const first = structuredClone(base);
  first.workouts[0].comment = 'Erste Handynotiz';
  for (const [revision, value] of [base, pc].entries()) {
    assert.equal((await call(api, { method: 'PUT', data: { revision, state: value } })).status, 200);
  }
  const reconcile = (server, bearer, revision, ancestor, local) => call(server, {
    method: 'POST', path: 'reconcile', remote: true, headers: { authorization: 'Bearer ' + bearer },
    data: { serverId, baseRevision: revision, baseState: ancestor, localState: local },
  });
  assert.deepEqual((await reconcile(api, token, 1, base, first)).data, { serverId, revision: 3 });

  const restart = createSyncApi(folder, fakePeer);
  const second = structuredClone(first);
  second.workouts[0].comment = 'Zweite Handynotiz';
  assert.equal((await reconcile(restart, other.token, 3, first, second)).status, 409);
  assert.equal((await reconcile(restart, token, 3, base, second)).status, 409);
  assert.deepEqual((await reconcile(restart, token, 3, first, second)).data, { serverId, revision: 4 });
  const expected = structuredClone(pc);
  expected.workouts[0].comment = 'Zweite Handynotiz';
  assert.deepEqual((await call(restart)).data, { serverId, revision: 4, state: expected });
});
