import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { neckTrapeziusWeight } from '../src/data/neckTrapeziusProjection.js';
import { createNeutralHeadGeometry } from '../src/components/muscle/neutralHead.js';

test('the paired neck-base projection ends at the shoulder/neck junction and fades smoothly to neutral', () => {
  const back = [0, 0, -1];
  assert.equal(neckTrapeziusWeight([0.025, 1.605, -0.09], back), 1);
  assert.equal(neckTrapeziusWeight([-0.025, 1.605, -0.09], back), 1);
  assert.equal(neckTrapeziusWeight([0, 1.63, -0.09], back), 0);
  assert.equal(neckTrapeziusWeight([0.025, 1.8, -0.1], back), 0);
  assert.equal(neckTrapeziusWeight([0.025, 1.65, 0.06], [0, 0, 1]), 0);
  assert.equal(neckTrapeziusWeight([0.1, 1.65, -0.1], back), 0);
  const weights = [1.608, 1.612, 1.616, 1.62, 1.625].map(y => neckTrapeziusWeight([0.025, y, -0.09], back));
  assert.equal(weights[0], 1); assert.equal(weights.at(-1), 0);
  assert.ok(weights.every((value, index) => !index || value < weights[index - 1]));
  assert.equal(neckTrapeziusWeight([NaN, 1.6, -0.1], back), 0);
  assert.equal(neckTrapeziusWeight([0.025, 1.64, -0.09], back), 0);
});

test('the current replacement-head mesh exposes the projection on the rear neck while the front stays neutral', () => {
  const bytes = fs.readFileSync(new URL('../public/anatomy/neutral-head.glb', import.meta.url));
  const size = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + size));
  const read = id => {
    const accessor = gltf.accessors[id], view = gltf.bufferViews[accessor.bufferView];
    const begin = 28 + size + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const components = accessor.type === 'VEC3' ? 3 : 1;
    const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[accessor.componentType];
    return new Type(Uint8Array.from(bytes.subarray(begin, begin + accessor.count * components * Type.BYTES_PER_ELEMENT)).buffer);
  };
  const primitive = gltf.meshes[0].primitives[0];
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.BufferAttribute(read(primitive.attributes.POSITION), 3));
  source.setIndex(new THREE.BufferAttribute(read(primitive.indices), 1));
  const geometry = createNeutralHeadGeometry(source);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  for (const [front, y] of [[false, 1.616], [true, 1.616], [false, 1.64], [false, 1.69]]) {
    ray.set(new THREE.Vector3(0.025, y, front ? 3 : -3), new THREE.Vector3(0, 0, front ? -1 : 1));
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit);
    const weight = neckTrapeziusWeight(hit.point.toArray(), hit.normal.toArray());
    assert.ok(front || y > 1.625 ? weight === 0 : weight > 0.4, `Visible ${front ? 'front' : 'back'} mask at ${y}: ${weight}`);
  }
  source.dispose(); geometry.dispose(); mesh.material.dispose();
});
