import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeTrainingPoint, shapeTrainingVertex } from '../scripts/trainingFigureShape.mjs';

test('lumbar relief is bilateral, shallow and clear of the spine, ribs and front', () => {
  for (const x of [-0.05, 0.05]) {
    const z = shapeTrainingPoint([x, 1.18, -0.12])[2];
    assert.ok(z < -0.128 && z >= -0.129);
  }
  for (const point of [[0, 1.18, -0.12], [0.05, 1.34, -0.12], [0.05, 1.18, 0.1], [0.13, 1.19, -0.12]]) {
    assert.deepEqual(shapeTrainingPoint(point), point);
  }
});

test('arms open symmetrically with rigid length below the shoulder and neutral hips', () => {
  const radius = ([x, y]) => Math.hypot(Math.abs(x) - 0.193, y - 1.505);
  for (const sign of [-1, 1]) {
    const wrist = [sign * 0.32, 0.90, -0.05];
    const posed = shapeTrainingPoint(wrist);
    assert.ok(Math.abs(posed[0]) > 0.37);
    assert.ok(Math.abs(radius(wrist) - radius(posed)) < 1e-8);
    assert.deepEqual(shapeTrainingPoint([sign * 0.17, 0.93, 0]), [sign * 0.17, 0.93, 0]);
  }
});

test('shaped normals remain perpendicular to a tangent through the lumbar slope', () => {
  const point = [0.066, 1.18, -0.12];
  const { normal } = shapeTrainingVertex(point, [0, 0, -1]);
  const a = shapeTrainingPoint([point[0] - 0.0001, point[1], point[2]]);
  const b = shapeTrainingPoint([point[0] + 0.0001, point[1], point[2]]);
  assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-8);
  assert.ok(Math.abs(normal[0]) > 0.1);
  assert.ok(Math.abs(normal.reduce((sum, n, i) => sum + n * (a[i] - b[i]), 0)) < 1e-8);
});
