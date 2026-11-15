import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEST_REGION_LABELS, chestSurfaceRegion, resolveChestProfile } from '../src/data/chestRegions.js';
import { calculateMuscleLoad } from '../src/utils/muscleLoad.js';
import { getExerciseMuscleAssignment, createAppMuscleMapping } from '../src/utils/muscleAssignments.js';
import { normalizeAppState, createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';
import { editExerciseRecord } from '../src/utils/exerciseEditing.js';

const now = '2026-11-15T12:00:00Z';
const baseAssignment = { exerciseId:'press', status:'confirmed', primary:['chest'], secondary:['triceps'], stabilizers:[] };
const legacyMapping = { groups:{chest:'Brust',triceps:'Trizeps'}, entries:[baseAssignment] };
const workout = { id:'w', date:'2026-11-14T12:00:00Z', completedAt:'2026-11-14T13:00:00Z', exercises:[{exerciseId:'press',name:'Bankdrücken',sets:[{id:'s',weight:40,reps:8,weightMode:'normal'}]}] };
function run(name,extra={}) {
  return calculateMuscleLoad({workouts:[workout],exercises:[{id:'press',name}],mapping:legacyMapping,now,...extra});
}

test('press variants produce distinct regional emphasis while every chest area still contributes',()=>{
  const flat=run('Bankdrücken'),incline=run('Schrägbankdrücken Stange');
  const decline=run('Custom press',{mapping:{...legacyMapping,entries:[{...baseAssignment,chestProfile:'decline'}]}});
  for(const result of [flat,incline,decline])for(const id of Object.keys(CHEST_REGION_LABELS))assert(result.muscles[id].rawLoad>0);
  assert(flat.muscles.chest_middle.rawLoad>flat.muscles.chest_lower.rawLoad);
  assert(flat.muscles.chest_lower.rawLoad>flat.muscles.chest_upper.rawLoad);
  assert(incline.muscles.chest_upper.rawLoad>incline.muscles.chest_middle.rawLoad);
  assert(incline.muscles.chest_middle.rawLoad>incline.muscles.chest_lower.rawLoad);
  assert(decline.muscles.chest_lower.rawLoad>decline.muscles.chest_middle.rawLoad);
  assert(decline.muscles.chest_middle.rawLoad>decline.muscles.chest_upper.rawLoad);
  assert.equal(flat.muscles.chest.rawLoad,incline.muscles.chest.rawLoad);
  assert.equal(flat.muscles.triceps.rawLoad,incline.muscles.triceps.rawLoad);
  assert.equal(flat.sessions[0].sets.length,1,'regional display does not create additional logged sets');
});

test('unknown machine angles, dips and malformed profiles do not get a guessed emphasis',()=>{
  for(const name of ['bankdrücken - Plate','dip plate','Dips','Renamed custom press']) {
    const result=run(name);
    assert.equal(result.muscles.chest_upper.rawLoad,result.muscles.chest_middle.rawLoad);
    assert.equal(result.muscles.chest_lower.rawLoad,result.muscles.chest_middle.rawLoad);
  }
  assert.equal(resolveChestProfile({chestProfile:'invalid'},'Schrägbankdrücken Stange'),'unspecified');
  assert.equal(resolveChestProfile({},'Something with Schrägbank in its name'),'unspecified');
});

test('regional history uses the same dates, decay and progression score without altering inputs',()=>{
  const inputs=structuredClone({workouts:[workout],mapping:legacyMapping});
  const before=structuredClone(inputs);
  const current=run('Schrägbankdrücken Stange',inputs);
  const later=run('Schrägbankdrücken Stange',{...inputs,now:'2026-11-17T12:00:00Z'});
  const old=run('Schrägbankdrücken Stange',{...inputs,now:'2026-11-30T12:00:00Z'});
  for(const id of Object.keys(CHEST_REGION_LABELS)) {
    assert.equal(current.muscles[id].lastTrainedDate,workout.date);
    assert(Math.abs(later.muscles[id].rawLoad/current.muscles[id].rawLoad-0.5)<1e-12);
    assert.equal(old.muscles[id].intensity,0);
    assert.equal(old.muscles[id].status,'older_history');
  }
  assert.deepEqual(inputs,before);
  assert.deepEqual(current.sessions[0].sets,run('Bankdrücken',inputs).sessions[0].sets);
});

test('saved regional profile survives rename and backup roundtrip with all set values',()=>{
  const state=normalizeAppState({exercises:[{id:'press',name:'schrägbankdrücken hantel'}],workouts:[workout],templates:[],maxStrengthRecords:[]});
  assert.equal(state.exercises[0].muscleAssignment.chestProfile,'incline');
  const renamed=editExerciseRecord(state,'press',{name:'Meine Druckübung'}).state;
  const restored=parseBackupPayload(JSON.stringify(createBackupPayload(renamed)));
  assert.equal(restored.exercises[0].muscleAssignment.chestProfile,'incline');
  assert.deepEqual(restored.workouts[0].exercises[0].sets,state.workouts[0].exercises[0].sets);
  const result=calculateMuscleLoad({workouts:restored.workouts,exercises:restored.exercises,mapping:createAppMuscleMapping(restored.exercises),now});
  assert(result.muscles.chest_upper.rawLoad>result.muscles.chest_lower.rawLoad);
});

test('explicit child assignments and parent-derived load use their strongest role once',()=>{
  const normal=run('Bankdrücken');
  const duplicated=run('Bankdrücken',{mapping:{...legacyMapping,entries:[{...baseAssignment,secondary:['triceps','chest_upper']}]}});
  assert.equal(duplicated.muscles.chest_upper.rawLoad,normal.muscles.chest_upper.rawLoad);
  assert.equal(getExerciseMuscleAssignment({name:'Bankdrücken',muscleAssignment:{status:'unassigned'}}).chestProfile,undefined);
});

test('chest surface borders are mirrored, continuous, bounded and converge laterally',()=>{
  const regions=new Set();
  const weights=([a,b,mix])=>Object.fromEntries(Object.keys(CHEST_REGION_LABELS).map(id=>[id,(id===a?1-mix:0)+(id===b?mix:0)]));
  for(const x of [0.01,0.05,0.12,0.2,0.235]) {
    let prior;
    for(let y=1.325;y<=1.55;y+=0.0002) {
      const region=chestSurfaceRegion(x,y);
      assert.deepEqual(region,chestSurfaceRegion(-x,y));
      assert(region[2]>=0&&region[2]<=1);
      const values=weights(region);
      assert(Math.abs(Object.values(values).reduce((a,b)=>a+b,0)-1)<1e-12);
      for(const [id,value]of Object.entries(values))if(value>0.8)regions.add(id);
      if(prior)for(const id of Object.keys(values))assert(Math.abs(values[id]-prior[id])<0.05);
      prior=values;
    }
  }
  assert.deepEqual([...regions].sort(),Object.keys(CHEST_REGION_LABELS).sort());
});
