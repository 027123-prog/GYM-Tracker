import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { readTraining } from '../scripts/read-training.mjs';

const privateDir = resolve('qa-localappdata');
const state = {
  workouts: [
    { id: 'old', name: 'Älteres Training', date: '2026-01-01' },
    { id: 'new', name: 'Training B', date: '2026-02-02', completedAt: null, exercises: [
      { id: 'row', name: 'Testgerät', sets: [{ id: 'set', weight: 20, reps: 6, comment: 'Test' }], notes: [{id:'note', comment:'QA'}], goal: { load: 20 } },
    ] },
  ], exercises: [], templates: [], maxStrengthRecords: [], customSetting: true,
};
const saved = { revision: 4, state, serverId: 'private-id', receipts: { 'device-fingerprint': [{ hash: 'ignored' }] } };
const answer = value => async () => ({ status: 200, json: async () => value });
const offline = async () => { throw new Error('Unreachable'); };

test('prefers the central dashboard, with the local header and no redirected requests', async () => {
  const actual = await readTraining([], {
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://127.0.0.1:8770/api/gym/trainingsstand');
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      assert.deepEqual(init.headers, { 'X-HardGain-Sync': '1' });
      return answer(saved)();
    },
    read: () => assert.fail('local fallback not required'),
  });
  assert.deepEqual(actual, { source:'zuhause-dashboard', revision:4, status:'ready', workoutCount:2,
    exerciseCount:0, templateCount:0, strengthRecordCount:0,
    latestWorkout:{ id:'new', name:'Training B', date:'2026-02-02', completedAt:null } });
});

test('uses the Gym endpoint when the central dashboard is unavailable or not yet upgraded', async () => {
  for (const dashboardAnswer of [offline, async () => ({status:404}), answer({wrong:true})]) {
    const calls = [];
    const result = await readTraining([], {
      fetchImpl:async (url, options) => {
        calls.push(url);
        assert.deepEqual(options.headers, {'X-HardGain-Sync':'1'});
        return calls.length === 1 ? dashboardAnswer() : answer(saved)();
      },
      read:() => assert.fail('local fallback not required'),
    });
    assert.deepEqual(calls, ['http://127.0.0.1:8770/api/gym/trainingsstand','http://127.0.0.1:4175/api/home-sync/state']);
    assert.equal(result.source, 'pc-service');
    assert.equal(result.revision, 4);
  }
});

test('the latest N records retain nested set comments, notes and targets', async () => {
  const result = await readTraining(['--last','1'], { fetchImpl:answer(saved) });
  assert.deepEqual(result.workouts, [state.workouts[1]]);
  assert.deepEqual(state.workouts.map(w=>w.id), ['old','new']);
});

test('reads only the standard private file when offline and excludes server-private metadata', async () => {
  const result = await readTraining(['--all'], {
    fetchImpl:offline, localAppData:privateDir,
    read:async (file, encoding) => {
      assert.equal(file, join(privateDir,'HardGainWAF','home-sync','state.json'));
      assert.equal(encoding, 'utf8');
      return '\uFEFF' + JSON.stringify(saved);
    },
  });
  assert.deepEqual(result, { source:'private-file', revision:4, status:'ready', state });
});

test('distinguishes a waiting server, a synced empty history and an unavailable source', async () => {
  const first = await readTraining([], { fetchImpl:answer({revision:0,state:null}) });
  assert.equal(first.status,'awaiting-first-sync');
  const noHistory = await readTraining([], { fetchImpl:answer({revision:1,state:{...state,workouts:[]}}) });
  assert.equal(noHistory.status,'ready');
  assert.equal(noHistory.latestWorkout,null);
  await assert.rejects(readTraining([], {fetchImpl:offline,localAppData:privateDir,
    read:async()=>{ throw Object.assign(new Error('sensitive path'), {code:'ENOENT'}); }}), /nicht erreichbar.*kein gespeicherter Abgleichstand/);
});

test('invalid local or HTTP data does not leak response bodies or private filesystem errors', async () => {
  await assert.rejects(readTraining([], {fetchImpl:answer({revision:10,state:null}),localAppData:privateDir,
    read:async()=>'{secret'}), {message:'Der gespeicherte Abgleichstand ist ungültig.'});
  await assert.rejects(readTraining([], {fetchImpl:async()=>({status:503}),localAppData:privateDir,
    read:async()=>{throw new Error('private-file-details');}}), /HTTP 503.*nicht lesbar/);
});

test('rejects wrong flags and invalid counts before attempting to access data', async () => {
  const noIO = { fetchImpl:() => assert.fail('unexpected read'), read:()=>assert.fail('unexpected read') };
  for (const args of [['--last','0'],['--last','-1'],['--last','1.5'],['--all','--last','1'],['--last']]) {
    await assert.rejects(readTraining(args, noIO), /Erwartet wird/);
  }
  assert.match(await readTraining(['--help'],noIO), /--last/);
});
