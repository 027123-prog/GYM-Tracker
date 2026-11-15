import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DIEGO_REGION_IDS, DIEGO_COVERAGE } from '../src/data/diegoAnatomy.js';
import { MUSCLE_GROUPS } from '../src/data/exerciseMuscles.js';

const bytes = fs.readFileSync(new URL('../public/anatomy/diego-training.glb',import.meta.url));
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
  assert.deepEqual(DIEGO_REGION_IDS.slice(1),Object.keys(MUSCLE_GROUPS));
  assert(manifest.maxAttributeRoundtripError<0.00001);
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
  assert.deepEqual([...painted].sort(),Object.keys(DIEGO_COVERAGE).filter(id=>DIEGO_COVERAGE[id]==='surface').sort());
});

test('deep training regions do not get invented exterior patches',()=>{
  assert.equal(DIEGO_COVERAGE.spinal_erectors,'not_exposed');
  assert.equal(DIEGO_COVERAGE.hip_flexors,'not_exposed');
  assert.equal(DIEGO_COVERAGE.chest,'aggregate');
  assert.equal(Object.values(DIEGO_COVERAGE).filter(value=>value==='surface').length,24);
  for(const node of model.nodes)for(const id of node.extras.regions)assert(id==='context'||DIEGO_COVERAGE[id]==='surface');
});
