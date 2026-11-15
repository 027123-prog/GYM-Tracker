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

// The MakeHuman head is prepared offline with coherent facial topology and
// fitted neutral eyes. Keep its sculpted features and attachment proportions;
// The concealed lower neck is tapered into the anatomy body's neck so the
// flat extraction boundary does not appear as a flared collar.
export function createNeutralHeadGeometry(source) {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const neck = 1 - THREE.MathUtils.smoothstep(y, 1.60, 1.67);
    positions.setX(i, positions.getX(i) * (1 - 0.5 * neck));
    positions.setZ(i, -0.025 + (positions.getZ(i) + 0.025) * (1 - 0.2 * neck));
  }
  geometry.computeVertexNormals();
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
