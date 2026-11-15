import * as THREE from 'three';

// Clip crossing triangles at an exact plane. Centroid-based removal leaves
// tall triangle tips visible around the junction with the neutral skin neck.
export function clipAtNeck(geometry, height = 1.615) {
  const source = geometry.getAttribute('position'), index = geometry.getIndex();
  const positions = [], indices = [], cache = new Map();
  const vertex = i => ({ key: `v${i}`, point: [source.getX(i), source.getY(i), source.getZ(i)] });
  const intersection = (a, b) => {
    const t = (height - a.point[1]) / (b.point[1] - a.point[1]);
    return { key: [a.key, b.key].sort().join(':'), point: [a.point[0] + t * (b.point[0] - a.point[0]), height, a.point[2] + t * (b.point[2] - a.point[2])] };
  };
  const add = item => {
    if (!cache.has(item.key)) { cache.set(item.key, positions.length / 3); positions.push(...item.point); }
    return cache.get(item.key);
  };
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [vertex(index.getX(i)), vertex(index.getX(i + 1)), vertex(index.getX(i + 2))];
    const polygon = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const insideA = a.point[1] <= height, insideB = b.point[1] <= height;
      if (insideA) polygon.push(a);
      if (insideA !== insideB) polygon.push(intersection(a, b));
    }
    for (let j = 1; j + 1 < polygon.length; j++) indices.push(add(polygon[0]), add(polygon[j]), add(polygon[j + 1]));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
