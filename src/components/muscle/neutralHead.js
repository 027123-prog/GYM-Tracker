import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function topology(geometry) {
  const count = geometry.getAttribute('position').count;
  const neighbors = Array.from({ length: count }, () => new Set());
  const edges = new Map();
  const indices = geometry.getIndex().array;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], opposite = triangle[(j + 2) % 3];
      neighbors[a].add(b);
      neighbors[b].add(a);
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      if (!edges.has(key)) edges.set(key, { a, b, opposite: [] });
      edges.get(key).opposite.push(opposite);
    }
  }
  const boundary = new Set();
  for (const edge of edges.values()) if (edge.opposite.length === 1) {
    boundary.add(edge.a);
    boundary.add(edge.b);
  }
  return { neighbors, edges, boundary };
}

// Position welding is necessary for the scanned source: coincident vertices
// otherwise keep hard normal seams, especially around the eyelids and lips.
export function weldAnatomyGeometry(source) {
  const positionsOnly = new THREE.BufferGeometry();
  positionsOnly.setAttribute('position', source.getAttribute('position').clone());
  if (source.getIndex()) positionsOnly.setIndex(source.getIndex().clone());
  const welded = mergeVertices(positionsOnly, 0.00002);
  positionsOnly.dispose();
  return welded;
}

// A positive/negative (Taubin) pair removes scanner stair-steps without the
// repeated shrinkage of plain Laplacian smoothing. Call after position welding.
export function smoothAnatomyGeometry(geometry, { iterations = 2, strength = 0.32, preserveBoundary = true } = {}) {
  const { neighbors, boundary } = topology(geometry);
  const position = geometry.getAttribute('position');
  let coordinates = Float32Array.from(position.array);
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (const amount of [strength, -strength * 1.04]) {
      const next = Float32Array.from(coordinates);
      for (let vertex = 0; vertex < position.count; vertex++) {
        if (!neighbors[vertex].size || (preserveBoundary && boundary.has(vertex))) continue;
        for (let axis = 0; axis < 3; axis++) {
          let sum = 0;
          for (const neighbor of neighbors[vertex]) sum += coordinates[neighbor * 3 + axis];
          const index = vertex * 3 + axis;
          next[index] += amount * (sum / neighbors[vertex].size - coordinates[index]);
        }
      }
      coordinates = next;
    }
  }
  position.array.set(coordinates);
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function subdivideHead(geometry) {
  const { neighbors, edges, boundary } = topology(geometry);
  const old = geometry.getAttribute('position');
  const positions = Array.from(old.array);
  for (let vertex = 0; vertex < old.count; vertex++) {
    if (boundary.has(vertex)) continue;
    const n = neighbors[vertex].size;
    if (!n) continue;
    const beta = n === 3 ? 3 / 16 : 3 / (8 * n);
    for (let axis = 0; axis < 3; axis++) {
      let sum = 0;
      for (const neighbor of neighbors[vertex]) sum += old.array[neighbor * 3 + axis];
      positions[vertex * 3 + axis] = (1 - n * beta) * old.array[vertex * 3 + axis] + beta * sum;
    }
  }
  for (const edge of edges.values()) {
    edge.vertex = positions.length / 3;
    for (let axis = 0; axis < 3; axis++) {
      const a = old.array[edge.a * 3 + axis], b = old.array[edge.b * 3 + axis];
      positions.push(edge.opposite.length === 2
        ? 0.375 * (a + b) + 0.125 * (old.array[edge.opposite[0] * 3 + axis] + old.array[edge.opposite[1] * 3 + axis])
        : 0.5 * (a + b));
    }
  }
  const indices = [], original = geometry.getIndex().array;
  const middle = (a, b) => edges.get(`${Math.min(a, b)},${Math.max(a, b)}`).vertex;
  for (let i = 0; i < original.length; i += 3) {
    const a = original[i], b = original[i + 1], c = original[i + 2];
    const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
    indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setIndex(indices);
  return result;
}

export { subdivideHead as subdivideAnatomyGeometry };

// Seat the MakeHuman collar inside the torso while retaining the widening
// of its sculpted nape toward the shoulders.
export function createNeutralHeadGeometry(source) {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y >= 1.67) continue;
    const x = positions.getX(i), z = positions.getZ(i);
    const throat = THREE.MathUtils.smoothstep(z, -0.055, 0.008);
    const collar = (1 - THREE.MathUtils.smoothstep(y, 1.60, 1.67))
      * (1 - THREE.MathUtils.smoothstep(z, 0.026, 0.055));
    const rim = 1 - THREE.MathUtils.smoothstep(y, 1.60, 1.623);
    const height = y - collar * (0.044 - 0.026 * throat);
    positions.setY(i, height);
    positions.setX(i, x * (1 - 0.07 * collar - 0.12 * rim));
    const groove = (1 - THREE.MathUtils.smoothstep(Math.abs(x), 0.002, 0.042))
      * THREE.MathUtils.smoothstep(-z, 0.064, 0.095);
    // Retain the transverse shape of the sculpt and fit its rear outline to
    // the shoulder slope. Both profiles meet at the base of the skull.
    const sourceDepth = 0.014 * ((1.67 - y) / 0.07) ** 2.4;
    const fittedDepth = 0.030 * ((1.67 - height) / 0.11) ** 2.5;
    const back = THREE.MathUtils.smoothstep(-z, 0.048, 0.095);
    const inset = 0.019 * (1 - THREE.MathUtils.smoothstep(height, 1.565, 1.615));
    positions.setZ(i, z + (sourceDepth - fittedDepth + inset) * back
      + 0.014 * rim * groove + 0.008 * throat * collar
      + rim * (-0.042 - z) * (0.16 + 0.24 * throat));
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
