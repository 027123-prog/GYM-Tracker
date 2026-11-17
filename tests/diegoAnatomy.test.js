import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DIEGO_REGION_IDS, DIEGO_COVERAGE } from '../src/data/diegoAnatomy.js';
import { MUSCLE_GROUPS } from '../src/data/exerciseMuscles.js';
import * as THREE from 'three';
import { DIEGO_ASSET_REVISION, DIEGO_MODEL_FILE } from '../src/data/diegoAnatomy.js';

const bytes = fs.readFileSync(new URL(`../public/anatomy/${DIEGO_MODEL_FILE}`,import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../public/anatomy/diego-manifest.json',import.meta.url),'utf8'));
const jsonSize = bytes.readUInt32LE(12), model = JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8'));
const binary = bytes.subarray(28+jsonSize);
await MeshoptDecoder.ready;
function decode(accessorId) {
  const accessor=model.accessors[accessorId], view=model.bufferViews[accessor.bufferView], extension=view.extensions.EXT_meshopt_compression;
  const result=new Uint8Array(extension.count*extension.byteStride);
  MeshoptDecoder.decodeGltfBuffer(result,extension.count,extension.byteStride,binary.subarray(extension.byteOffset,extension.byteOffset+extension.byteLength),extension.mode,extension.filter);
  const Type={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[accessor.componentType];
  return new Type(result.buffer);
}

test('prepared anatomy pins provenance, palette order and model content',()=>{
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  assert.equal(manifest.sourceGitBlob,'71b2f537687dcf821e8d82e030237b68f9042364');
  assert.deepEqual(model.asset.extras.regionIds,DIEGO_REGION_IDS);
  assert.deepEqual(manifest.regionIds,DIEGO_REGION_IDS);
  assert.equal(manifest.assetRevision,DIEGO_ASSET_REVISION);
  assert.equal(model.asset.extras.assetRevision,DIEGO_ASSET_REVISION);
  assert.deepEqual(DIEGO_REGION_IDS.slice(1),Object.keys(MUSCLE_GROUPS));
  assert(manifest.maxAttributeRoundtripError<0.00001);
});

test('lumbar and hip-flexor colors reach the outermost visible surface rather than a hidden layer',()=>{
  const objects=[];
  for(const mesh of model.meshes)for(const primitive of mesh.primitives){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(decode(primitive.attributes.POSITION),3));
    geometry.setAttribute('_training',new THREE.BufferAttribute(decode(primitive.attributes._TRAINING),4));
    geometry.setIndex(new THREE.BufferAttribute(decode(primitive.indices),1));
    objects.push(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
  }
  const ray=new THREE.Raycaster();
  const visibleWeight=(x,y,front,region)=>{
    ray.set(new THREE.Vector3(x,y,front?3:-3),new THREE.Vector3(0,0,front?-1:1));
    const hit=ray.intersectObjects(objects,false)[0];assert(hit);
    const geometry=hit.object.geometry,p=geometry.getAttribute('position'),t=geometry.getAttribute('_training');
    const ids=[hit.face.a,hit.face.b,hit.face.c];
    const triangle=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id));
    const weights=THREE.Triangle.getBarycoord(hit.point,...triangle,new THREE.Vector3()).toArray();
    const target=DIEGO_REGION_IDS.indexOf(region);
    return ids.reduce((sum,id,i)=>sum+weights[i]*((t.getX(id)===target?1-t.getZ(id)/255:0)+(t.getY(id)===target?t.getZ(id)/255:0)),0);
  };
  assert(visibleWeight(.05,1.18,false,'spinal_erectors')>.75);
  assert(visibleWeight(-.05,1.18,false,'spinal_erectors')>.75);
  assert(visibleWeight(.09,1.02,true,'hip_flexors')>.65);
  assert.equal(visibleWeight(.05,1.18,true,'spinal_erectors'),0);
  for(const object of objects){object.geometry.dispose();object.material.dispose();}
});

test('all prepared triangles decode with finite surfaces and valid muscle IDs',()=>{
  let triangles=0;const painted=new Set();
  for(const mesh of model.meshes)for(const primitive of mesh.primitives){
    const positions=decode(primitive.attributes.POSITION),normals=decode(primitive.attributes.NORMAL),uv=decode(primitive.attributes.TEXCOORD_0),regions=decode(primitive.attributes._TRAINING),index=decode(primitive.indices);
    const count=positions.length/3;
    assert.equal(normals.length,positions.length);assert.equal(uv.length,count*2);assert.equal(regions.length,count*4);
    assert(positions.every(Number.isFinite));assert(normals.every(Number.isFinite));assert(uv.every(Number.isFinite));
    for(let i=0;i<count;i++){
      assert(positions[i*3+1]<=1.61501,'no exposed source face remains');
      for(const id of [regions[i*4],regions[i*4+1]]){assert(id<DIEGO_REGION_IDS.length);if(id)painted.add(DIEGO_REGION_IDS[id]);}
      if(regions[i*4]===DIEGO_REGION_IDS.indexOf('tibialis')) {
        assert(positions[i*3+2]<0.05,'tibialis surface does not include the toe-extensor fan');
      }
    }
    assert(index.every(id=>id<count));assert.equal(index.length%3,0);triangles+=index.length/3;
  }
  assert.equal(triangles,manifest.meshes.reduce((sum,m)=>sum+m.triangles,0));
  assert.deepEqual([...painted].sort(),Object.keys(DIEGO_COVERAGE).filter(id=>DIEGO_COVERAGE[id]!=='aggregate').sort());
});

test('covered training regions have documented projections on existing geometry and serratus is exposed',()=>{
  assert.equal(DIEGO_COVERAGE.spinal_erectors,'projection');
  assert.equal(DIEGO_COVERAGE.hip_flexors,'projection');
  assert.equal(DIEGO_COVERAGE.serratus,'surface');
  assert.equal(DIEGO_COVERAGE.chest,'aggregate');
  assert.equal(Object.values(DIEGO_COVERAGE).filter(value=>value==='surface').length,25);
  assert.equal(manifest.meshes.reduce((sum,m)=>sum+m.triangles,0),546385,'surface shaping retains the source topology');
  for(const node of model.nodes)for(const id of node.extras.regions)assert(id==='context'||['surface','projection'].includes(DIEGO_COVERAGE[id]));
});
