import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { subdivideAnatomyGeometry } from '../src/components/muscle/neutralHead.js';

const [basePath, targetPath, eyesPath, eyeFitPath, outputPath = 'public/anatomy/neutral-head.glb'] = process.argv.slice(2);
if (!basePath || !targetPath || !eyesPath || !eyeFitPath) throw new Error('Pass MakeHuman base.obj, male-young.target, high-poly.obj and high-poly.mhclo');

function parseObj(path) {
  const vertices = [], groups = new Map();
  let name = 'default';
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') vertices.push(fields.slice(1, 4).map(Number));
    if (fields[0] === 'g') name = fields[1];
    if (fields[0] === 'f') {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(fields.slice(1).map(field => Number(field.split('/')[0]) - 1));
    }
  }
  return { vertices, groups };
}

const base = parseObj(basePath);
for (const line of fs.readFileSync(targetPath, 'utf8').split(/\r?\n/)) {
  if (!/^\d+\s/.test(line)) continue;
  const [id, ...delta] = line.split(/\s+/).map(Number);
  for (let axis = 0; axis < 3; axis++) base.vertices[id][axis] += delta[axis];
}
const bodyFaces = base.groups.get('body');
const bodyIds = [...new Set(bodyFaces.flat())];
const minY = Math.min(...bodyIds.map(id => base.vertices[id][1]));
const maxY = Math.max(...bodyIds.map(id => base.vertices[id][1]));
const scale = 1.88 / (maxY - minY);
const headPoints = bodyIds.map(id => base.vertices[id]).filter(point => (point[1] - minY) * scale > 1.66);
const front = Math.max(...headPoints.map(point => point[2]));
const rear = Math.min(...headPoints.map(point => point[2]));
const zCenter = (front + rear) / 2;
const transform = ([x, y, z]) => [x * scale, (y - minY) * scale, (z - zCenter) * scale - 0.011];

function geometryFromFaces(vertices, faces, clip = false) {
  const positions = [], indices = [], cache = new Map();
  const add = point => {
    const key = point.map(value => value.toFixed(7)).join(',');
    if (!cache.has(key)) { cache.set(key, positions.length / 3); positions.push(...point); }
    return cache.get(key);
  };
  for (const face of faces) {
    let polygon = face.map(id => transform(vertices[id]));
    if (clip) {
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const insideA = a[1] >= 1.6, insideB = b[1] >= 1.6;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) {
          const t = (1.6 - a[1]) / (b[1] - a[1]);
          clipped.push([a[0] + (b[0] - a[0]) * t, 1.6, a[2] + (b[2] - a[2]) * t]);
        }
      }
      polygon = clipped;
    }
    for (let i = 1; i + 1 < polygon.length; i++) indices.push(add(polygon[0]), add(polygon[i]), add(polygon[i + 1]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

const rawHead = geometryFromFaces(base.vertices, bodyFaces, true);
const head = subdivideAnatomyGeometry(rawHead);
rawHead.dispose();
head.computeVertexNormals();
const eyes = parseObj(eyesPath);
const fitLines = fs.readFileSync(eyeFitPath, 'utf8').split(/\r?\n/);
const fitScale = [1, 1, 1];
for (const line of fitLines) if (/^[xyz]_scale /.test(line)) {
  const [label, a, b, denominator] = line.split(/\s+/);
  const axis = 'xyz'.indexOf(label[0]);
  fitScale[axis] = Math.abs(base.vertices[Number(a)][axis] - base.vertices[Number(b)][axis]) / Number(denominator);
}
const fitStart = fitLines.findIndex(line => line.startsWith('verts ')) + 1;
let eyeVertex = 0;
for (const line of fitLines.slice(fitStart)) {
  if (!/^\d+\s/.test(line)) continue;
  const values = line.trim().split(/\s+/).map(Number);
  if (values.length !== 9) break;
  eyes.vertices[eyeVertex++] = [0, 1, 2].map(axis => values.slice(0, 3).reduce((sum, id, slot) => sum + base.vertices[id][axis] * values[slot + 3], 0) + values[axis + 6] * fitScale[axis]);
}
if (eyeVertex !== eyes.vertices.length) throw new Error('Eye fitting table does not match the mesh');
const eyeGeometry = geometryFromFaces(eyes.vertices, [...eyes.groups.values()].flat());
eyeGeometry.computeVertexNormals();
const geometry = mergeGeometries([head, eyeGeometry]);
head.dispose(); eyeGeometry.dispose();
geometry.computeBoundingBox();
const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), index = geometry.getIndex();
const positionBytes = Buffer.from(position.array.buffer), normalBytes = Buffer.from(normal.array.buffer);
const indexBytes = Buffer.from(new Uint32Array(index.array).buffer);
const binary = Buffer.concat([positionBytes, normalBytes, indexBytes]);
const metadata = {
  asset: { version: '2.0', generator: 'HardGainWAF MakeHuman head extraction', copyright: 'MakeHuman Team, Data Collection AB, Joel Palmius, Jonas Hauquier, Manuel Bastioni. Assets CC0 1.0 Universal.' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Neutral MakeHuman head', mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'Neutral sculpture', pbrMetallicRoughness: { baseColorFactor: [0.65, 0.68, 0.7, 1], roughnessFactor: 0.8, metallicFactor: 0 } }],
  buffers: [{ byteLength: binary.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positionBytes.length }, { buffer: 0, byteOffset: positionBytes.length, byteLength: normalBytes.length }, { buffer: 0, byteOffset: positionBytes.length + normalBytes.length, byteLength: indexBytes.length }],
  accessors: [{ bufferView: 0, componentType: 5126, count: position.count, type: 'VEC3', min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() }, { bufferView: 1, componentType: 5126, count: normal.count, type: 'VEC3' }, { bufferView: 2, componentType: 5125, count: index.count, type: 'SCALAR' }],
};
const rawJson = Buffer.from(JSON.stringify(metadata));
const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 32)]);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outputPath, Buffer.concat([header, json, binaryHeader, binary]));
console.log(JSON.stringify({ vertices: position.count, triangles: index.count / 3, bounds: [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()], sources: [basePath, targetPath, eyesPath, eyeFitPath].map(path => ({ path, sha256: crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex') })) }, null, 2));
