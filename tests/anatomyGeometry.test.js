import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clipAtNeck } from '../src/components/muscle/anatomyGeometry.js';
import { createAbdominalWall, recessAbdominalSheet } from '../src/components/muscle/athleticAnatomy.js';

test('neck clipping preserves the visible polygon and its winding at the exact plane', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 1, 0, 1, 1, 0, 0, 2, 0], 3));
  geometry.setIndex([0, 1, 2]);
  clipAtNeck(geometry, 1.5);
  const p = geometry.getAttribute('position'), index = geometry.getIndex();
  assert.equal(p.count, 4);
  assert.equal(index.count, 6);
  let area = 0;
  for (let i = 0; i < p.count; i++) assert(p.getY(i) <= 1.5);
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 2));
    const cross = b.sub(a).cross(c.sub(a));
    assert(cross.z > 0);
    area += cross.length() / 2;
  }
  assert.equal(area, 0.75);
  geometry.dispose();
});

test('rectus and flank panels share positions and normals without a visible split', () => {
  const pieces = createAbdominalWall();
  assert.equal(pieces.length, 4);
  for (const start of [0, 2]) {
    const abs = pieces[start].geometry, flank = pieces[start + 1].geometry;
    for (const attribute of ['position', 'normal']) {
      const a = abs.getAttribute(attribute), b = flank.getAttribute(attribute);
      for (let row = 0; row <= 100; row++) for (let axis = 0; axis < 3; axis++) {
        assert(Math.abs(a.array[(row * 29 + 28) * 3 + axis] - b.array[(row * 39) * 3 + axis]) < 1e-6);
      }
    }
  }
  for (const {geometry} of pieces) {
    for (const attribute of ['position', 'normal', 'uv']) assert(geometry.getAttribute(attribute).array.every(Number.isFinite));
    const p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), index = geometry.getIndex();
    const i = Math.floor(index.count / 6) * 3;
    const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 2));
    assert(b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3().fromBufferAttribute(normal, index.getX(i))) > 0);
    geometry.dispose();
  }
});

test('abdominal adaptation leaves points outside the abdominal region unchanged', () => {
  for (const point of [[0, 1.6, 0.1], [0.3, 1.2, 0.1], [0.01, 0.6, 0.05], [0, 1.2, -0.2]]) {
    assert.deepEqual(recessAbdominalSheet(...point), point);
  }
});
