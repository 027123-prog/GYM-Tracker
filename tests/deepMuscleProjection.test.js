import assert from 'node:assert/strict';
import test from 'node:test';
import {lumbarProjection,hipFlexorProjection,projectDeepRegion} from '../src/data/deepMuscleProjection.js';
test('lumbar projection shows paired columns while preserving the spinal midline and other body areas',()=>{
 assert(lumbarProjection([.05,1.18,-.1])>.9);
 assert.equal(lumbarProjection([0,1.18,-.1]),0);
 assert.equal(lumbarProjection([.2,1.18,-.1]),0);
 assert.equal(lumbarProjection([.05,1.5,-.1]),0);
 assert.equal(lumbarProjection([.05,1.18,.1]),0);
 assert.equal(lumbarProjection([.05,1.18,-.1],[0,0,1]),0);
});
test('hip flexor windows stay at the anterior hip and both projected masks remain mirrored, bounded and continuous',()=>{
 assert(hipFlexorProjection([.09,1.02,.08])>.8);
 assert.equal(hipFlexorProjection([0,1.02,.08]),0);
 assert.equal(hipFlexorProjection([.09,1.5,.08]),0);
 assert.equal(hipFlexorProjection([.09,1.02,-.08]),0);
 for(const fn of [lumbarProjection,hipFlexorProjection])for(const z of [-.1,.1]){
  for(let y=.85;y<1.4;y+=.01){let previous=0;for(let x=0;x<.2;x+=.0005){
   const value=fn([x,y,z]);assert(value>=0&&value<=1);assert.equal(value,fn([-x,y,z]));assert(Math.abs(value-previous)<.08);previous=value;
  }}
 }
});
test('deep projections respect front/back material boundaries and leave unrelated muscles unchanged',()=>{
 assert.equal(projectDeepRegion(['lats','lats',0],'defaultMat_8',[.05,1.18,-.1],[0,0,-1])[1],'spinal_erectors');
 assert.equal(projectDeepRegion(['obliques','obliques',0],'defaultMat_3',[.09,1.02,.08],[0,0,1])[1],'hip_flexors');
 assert.deepEqual(projectDeepRegion(['upper_back','upper_back',0],'defaultMat_8',[.05,1.18,-.1],[0,0,-1]),['upper_back','upper_back',0]);
 assert.deepEqual(projectDeepRegion(['glutes','glutes',0],'defaultMat_12',[.05,1.18,-.1],[0,0,-1]),['glutes','glutes',0]);
});
