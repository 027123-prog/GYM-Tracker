import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { abdominalPoint, abdominalProfile } from './athleticAnatomy';

const smooth = (value, low, high) => THREE.MathUtils.smoothstep(value, low, high);

// The source separates clavicular, sternocostal and inferior fibers with deep
// gaps. Sample their anterior envelope so the training view can show one
// continuous superficial pectoralis, retaining the source's depth/attachment.
function anteriorField(source, size = 80) {
  const p = source.getAttribute('position'), index = source.getIndex();
  const points = Array.from({ length: p.count }, (_, i) => [Math.abs(p.getX(i)), p.getY(i), p.getZ(i)]);
  const minX = 0, maxX = Math.max(...points.map(v => v[0]));
  const minY = Math.min(...points.map(v => v[1])), maxY = Math.max(...points.map(v => v[1]));
  const dx = (maxX - minX) / (size - 1), dy = (maxY - minY) / (size - 1);
  let field = new Float32Array(size * size).fill(-Infinity);
  for (let i = 0; i < index.count; i += 3) {
    const a = points[index.getX(i)], b = points[index.getX(i + 1)], c = points[index.getX(i + 2)];
    const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(area) < 1e-12) continue;
    const loX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) / dx));
    const hiX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0]) / dx));
    const loY = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - minY) / dy));
    const hiY = Math.min(size - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - minY) / dy));
    for (let row = loY; row <= hiY; row++) for (let col = loX; col <= hiX; col++) {
      const x = col * dx, y = minY + row * dy;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / area;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / area;
      const w = 1 - u - v;
      if (Math.min(u, v, w) < -1e-5) continue;
      const at = row * size + col;
      field[at] = Math.max(field[at], u * a[2] + v * b[2] + w * c[2]);
    }
  }
  // Fill only the gaps of the sampled field. A regular front surface avoids
  // intersecting floating strips while preserving the fan's overall depth.
  for (let pass = 0; pass < size * 2; pass++) {
    const next = field.slice();
    let missing = 0;
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const at = row * size + col;
      if (Number.isFinite(field[at])) continue;
      let sum = 0, count = 0;
      for (const [r, c] of [[row-1, col], [row+1, col], [row, col-1], [row, col+1]]) {
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const value = field[r * size + c];
        if (Number.isFinite(value)) { sum += value; count++; }
      }
      if (count) next[at] = sum / count; else missing++;
    }
    field = next;
    if (!missing) break;
  }
  for (let pass = 0; pass < 12; pass++) {
    const next = field.slice();
    for (let row = 1; row < size - 1; row++) for (let col = 1; col < size - 1; col++) {
      const at = row * size + col;
      next[at] = field[at] * 0.5 + (field[at-1] + field[at+1] + field[at-size] + field[at+size]) * 0.125;
    }
    field = next;
  }
  return {
    maxX,
    sample(x, y) {
      const col = THREE.MathUtils.clamp(x / dx, 0, size - 1.00001);
      const row = THREE.MathUtils.clamp((y - minY) / dy, 0, size - 1.00001);
      const c = Math.floor(col), r = Math.floor(row), u = col-c, v = row-r;
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(field[r*size+c], field[r*size+c+1], u),
        THREE.MathUtils.lerp(field[(r+1)*size+c], field[(r+1)*size+c+1], u), v);
    },
  };
}

// Input: one complete source chest in normalized body coordinates, before the
// shared athletic cage. Output: a fresh closed fan-shaped surface with a thin
// attachment margin. No oval primitives or detached lower pectoral strips.
export function createChestSurface(source) {
  const field = anteriorField(source);
  const sourcePositions = source.getAttribute('position');
  let meanX = 0;
  for (let i = 0; i < sourcePositions.count; i++) meanX += sourcePositions.getX(i);
  const side = Math.sign(meanX) || 1;
  const columns = 64, rows = 60, stride = columns + 1;
  const positions = [], uv = [], indices = [];
  for (const back of [false, true]) for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, v = row / rows;
    const x = 0.0034 + (field.maxX - 0.0034) * u - 0.012 * smooth(u, 0.75, 1) * Math.pow(2*v-1, 2);
    const low = 1.380 - 0.028 * Math.pow(Math.sin(Math.PI * u), 0.7) + 0.025 * u*u*u;
    const high = 1.552 - 0.060 * u*u*u;
    const y = THREE.MathUtils.lerp(low, high, v);
    const fullness = Math.pow(Math.max(0, Math.sin(Math.PI*u)), 0.65)
      * Math.pow(Math.max(0, Math.sin(Math.PI*v)), 1.3);
    const thickness = 0.029 * fullness;
    let base = 0.125 - 0.30 * (y - 1.4) - 0.140 * Math.pow(x / 0.225, 2);
    const analyticFront = base + thickness;
    // Keep only a low-amplitude residual from the measured source; its
    // separate deep heads must not emboss sharp ridges into the outer skin.
    base += THREE.MathUtils.clamp((field.sample(x, y) - analyticFront) * 0.12, -0.003, 0.003) * fullness;
    const abdomen = abdominalProfile(y);
    if (y < 1.43 && x < abdomen.width) {
      const contact = abdominalPoint(Math.asin(x / abdomen.width), y)[2] - 0.003;
      const tuck = (1 - smooth(v, 0, 0.35)) * (1 - smooth(y, 1.405, 1.43));
      base = THREE.MathUtils.lerp(base, contact, tuck);
    }
    // Front and back meet at the SAME rounded perimeter. Welding the shared
    // edge below removes the vertical cut strip of the previous sheet.
    const z = base + (back ? -0.45 : 1) * thickness;
    positions.push(side*x, y, z);
    uv.push(u, v);
    if (row && col) {
      const base = back ? (rows+1)*stride : 0;
      const a = base + row*stride+col, b = a-stride;
      // At these two corners the other diagonal avoids coincident front/back
      // triangles made entirely from the shared rim vertices.
      const corner = (row === 1 && col === 1) || (row === rows && col === columns);
      const face = corner ? [b-1, b, a, b-1, a, a-1] : [b-1, b, a-1, a-1, b, a];
      if ((side > 0) !== back) indices.push(...face);
      else indices.push(face[0], face[2], face[1], face[3], face[5], face[4]);
    }
  }
  const initial = new THREE.BufferGeometry();
  initial.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  initial.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  initial.setIndex(indices);
  const result = mergeVertices(initial, 0.000001);
  initial.dispose();
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
