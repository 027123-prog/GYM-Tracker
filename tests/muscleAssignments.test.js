import assert from 'node:assert/strict';
import test from 'node:test';
import { getExerciseMuscleAssignment, createAppMuscleMapping, getNewExerciseVariant } from '../src/utils/muscleAssignments.js';
import { normalizeAppState, createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';
import { editExerciseRecord } from '../src/utils/exerciseEditing.js';
import { getAnatomyRegion, ANATOMY_REGIONS } from '../src/data/anatomyRegions.js';
import { MUSCLE_GROUPS } from '../src/data/exerciseMuscles.js';

test('known exact aliases match while unknown exercises are not guessed from fragments', () => {
  assert.deepEqual(getExerciseMuscleAssignment({ name: 'Kniebeuge – Langhantel' }).primary, ['quads', 'glutes']);
  assert.equal(getExerciseMuscleAssignment({ name: 'Something resembling a bench exercise' }), null);
  assert.equal(getExerciseMuscleAssignment({ name: 'Brachio Curls' }).status, 'tentative_variant');
});

test('renaming and export/import preserve the assignment identity and all historical sets', () => {
  const state = normalizeAppState({ exercises: [{ id: 'e', name: 'Bankdrücken' }], templates: [], workouts: [
    { id: 'w', date: '2026-10-01', completedAt: '2026-10-01', exercises: [{ id: 'entry', exerciseId: 'e', name: 'Bankdrücken', sets: [{ id: 's', weight: 40, reps: 8 }] }] },
  ], maxStrengthRecords: [] });
  const before = structuredClone(state.workouts[0].exercises[0].sets);
  const renamed = editExerciseRecord(state, 'e', { name: 'My custom press' }).state;
  const roundtrip = parseBackupPayload(JSON.stringify(createBackupPayload(renamed)));
  assert.deepEqual(roundtrip.exercises[0].muscleAssignment, state.exercises[0].muscleAssignment);
  assert.deepEqual(roundtrip.workouts[0].exercises[0].sets, before);
  assert.deepEqual(createAppMuscleMapping(roundtrip.exercises).entries[0].primary, ['chest']);
});

test('a new deadlift gets a new variant without relabeling old workout entries', () => {
  const old = { id: 'w', date: '2026-10-01', completedAt: '2026-10-01', exercises: [{ id: 'old', exerciseId: 'e', name: 'Kreuzheben', sets: [] }] };
  const state = normalizeAppState({ exercises: [{ id: 'e', name: 'Kreuzheben' }], workouts: [old], templates: [], maxStrengthRecords: [] });
  assert.equal(getNewExerciseVariant(state.exercises[0]), 'floor_reset');
  assert.equal(state.workouts[0].exercises[0].variantKey, undefined);
  state.workouts[0].exercises[0].variantKey = 'floor_reset';
  assert.equal(parseBackupPayload(JSON.stringify(createBackupPayload(state))).workouts[0].exercises[0].variantKey, 'floor_reset');
});

test('archived and orphaned historical exercises retain their muscle mappings', () => {
  const result = createAppMuscleMapping([{ id: 'a', name: 'Seitheben Kabel', archivedAt: '2026-01-01' }], [
    { exercises: [{ exerciseId: 'removed', name: 'Beinpresse' }] },
  ]);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.find(item => item.exerciseId === 'removed').primary, ['quads', 'glutes']);
});

test('stored roles are validated, de-duplicated and can explicitly leave an exercise unmapped', () => {
  const assignment = getExerciseMuscleAssignment({ name: 'Bankdrücken', muscleAssignment: { status: 'confirmed', primary: ['chest', 'unknown'], secondary: ['chest', 'triceps'] } });
  assert.deepEqual(assignment.primary, ['chest']);
  assert.deepEqual(assignment.secondary, ['triceps']);
  assert.equal(getExerciseMuscleAssignment({ name: 'Bankdrücken', muscleAssignment: { status: 'unassigned' } }).status, 'unassigned');
});

test('anatomy regions cover all training groups without assigning one structure twice', () => {
  assert.deepEqual(Object.keys(ANATOMY_REGIONS).sort(), Object.keys(MUSCLE_GROUPS).sort());
  const keys = Object.values(ANATOMY_REGIONS).flat();
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(getAnatomyRegion('trapezius_upper'), 'upper_traps');
  assert.equal(getAnatomyRegion('trapezius_lower'), 'upper_back');
  assert.equal(getAnatomyRegion('gluteus_maximus'), 'glutes');
  assert.equal(getAnatomyRegion('subscapularis'), null, 'not an external shoulder rotator');
});

test('old automatic drafts upgrade their exact known roles, while custom or confirmed assignments remain unchanged', () => {
  const legacy={version:1,status:'draft_assigned',primary:['glutes','quads','spinal_erectors'],secondary:['hamstrings','adductors','upper_back'],stabilizers:['abs','obliques','forearm_flexors']};
  const upgraded=getExerciseMuscleAssignment({name:'Kreuzheben',muscleAssignment:legacy});
  assert(!upgraded.primary.includes('quads'));
  assert(upgraded.secondary.includes('quads'));
  assert(upgraded.stabilizers.includes('upper_back'));
  assert.equal(upgraded.ruleSource,'catalogue');
  assert.equal(upgraded.ruleRevision,4);
  assert.deepEqual(getExerciseMuscleAssignment({name:'Mein umbenanntes Heben',muscleAssignment:upgraded}),upgraded);
  const confirmed=getExerciseMuscleAssignment({name:'Kreuzheben',muscleAssignment:{...legacy,status:'confirmed'}});
  assert.deepEqual(confirmed.primary,legacy.primary);
  const custom=getExerciseMuscleAssignment({name:'Kreuzheben',muscleAssignment:{...legacy,primary:['lats']}});
  assert.deepEqual(custom.primary,['lats']);
  const explicitCustom=getExerciseMuscleAssignment({name:'Kreuzheben',muscleAssignment:{...legacy,ruleSource:'custom'}});
  assert.deepEqual(explicitCustom.primary,legacy.primary);
});

test('plan display aliases resolve exactly and isolation exercises do not invent supporting muscle work', () => {
  assert.deepEqual(getExerciseMuscleAssignment({name:'Low Row Plate – trapezbetont'}).primary,['upper_back']);
  assert.deepEqual(getExerciseMuscleAssignment({name:'Row Plate – latbetont'}).primary,['lats']);
  const triceps=getExerciseMuscleAssignment({name:'Trizepsdrücken am Kabelzug'});
  assert.deepEqual(triceps.primary,['triceps']);
  assert.deepEqual(triceps.secondary,[]);
  const reverse=getExerciseMuscleAssignment({name:'Reverse fly - machine'});
  assert(!reverse.primary.includes('external_rotators')&&!reverse.secondary.includes('external_rotators'));
  assert(reverse.stabilizers.includes('external_rotators'));
});

test('legacy and renamed automatic rowing assignments gain upper trapezius involvement without overwriting confirmed exclusions', () => {
  const old = { status: 'draft_assigned', primary: ['upper_back'], secondary: ['lats', 'rear_delts', 'elbow_flexors'], stabilizers: ['forearm_flexors'] };
  const exercise = { name: 'Low Row Plate', muscleAssignment: old };
  const snapshot = structuredClone(exercise);
  const updated = getExerciseMuscleAssignment(exercise);
  assert.ok(updated.secondary.includes('upper_traps'));
  assert.equal(updated.ruleRevision, 4);
  const renamed = getExerciseMuscleAssignment({ name: 'Mein Rudern', muscleAssignment: { ...old, ruleSource: 'catalogue', ruleKey: 'Low Row Plate', ruleRevision: 3 } });
  assert.ok(renamed.secondary.includes('upper_traps'));
  assert.deepEqual(getExerciseMuscleAssignment({ ...exercise, muscleAssignment: { ...old, status: 'confirmed' } }).secondary, old.secondary);
  assert.deepEqual(exercise, snapshot);
  assert.ok(getExerciseMuscleAssignment({ name: 'Row Plate – latbetont' }).stabilizers.includes('upper_traps'));
  assert.ok(getExerciseMuscleAssignment({ name: 'Face Pull' }).stabilizers.includes('upper_traps'));
});

test('structured RIR and explicit warm-up flags survive backup normalization without changing historical load values', () => {
  const state=normalizeAppState({exercises:[],templates:[],maxStrengthRecords:[],workouts:[{id:'w',date:'2026-11-13',completedAt:'2026-11-13',exercises:[{id:'e',exerciseId:'e',name:'My exercise',sets:[
    {id:'s1',weight:40,reps:8,rir:2,setType:'warmup'},
    {id:'s2',weight:50,reps:5,rir:0,setType:'work'},
    {id:'s3',weight:10,reps:8,rir:'0',invalid:true},
  ]}]}]});
  const restored=parseBackupPayload(JSON.stringify(createBackupPayload(state)));
  const sets=restored.workouts[0].exercises[0].sets;
  assert.deepEqual(sets.map(set=>[set.weight,set.reps]),[[40,8],[50,5],[10,8]]);
  assert.deepEqual(sets.map(set=>set.rir),[2,0,undefined]);
  assert.equal(sets[0].setType,'warmup');
  assert.equal(sets[2].invalid,true);
});
