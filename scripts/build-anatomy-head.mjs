import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const sourcePath = process.argv[2];
// Historical BodyParts3D comparison only. The production head is built with
// build-makehuman-head.mjs; keep this output separate from that active asset.
if (!sourcePath) throw new Error('Pass the openly licensed open-anatomy-3d anatomy-male.glb source');
const source = fs.readFileSync(sourcePath);
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
gltf.scene.updateMatrixWorld(true);
let skin;
gltf.scene.traverse(object => { if (object.isMesh && /^skin(?:_\d+)?$/.test(object.name)) skin = object; });
if (!skin) throw new Error('No skin mesh in source');
const bounds = new THREE.Box3().setFromObject(skin);
const center = bounds.getCenter(new THREE.Vector3());
const scale = 1.88 / (bounds.max.y - bounds.min.y);
const transform = new THREE.Matrix4().makeScale(scale, scale, scale)
  .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z)).multiply(skin.matrixWorld);
const original = skin.geometry.getAttribute('position');
const index = skin.geometry.getIndex();
const positions = [], indices = [], used = new Map();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
for (let i = 0; i < index.count; i += 3) {
  const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
  a.fromBufferAttribute(original, ids[0]).applyMatrix4(transform);
  b.fromBufferAttribute(original, ids[1]).applyMatrix4(transform);
  c.fromBufferAttribute(original, ids[2]).applyMatrix4(transform);
  if (Math.min(a.y, b.y, c.y) < 1.605) continue;
  for (const [slot, vertex] of [a, b, c].entries()) {
    if (!used.has(ids[slot])) { used.set(ids[slot], used.size); positions.push(vertex.x, vertex.y, vertex.z); }
    indices.push(used.get(ids[slot]));
  }
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setIndex(indices);
geometry.computeVertexNormals();
const positionBytes = Buffer.from(new Float32Array(positions).buffer);
const normalBytes = Buffer.from(geometry.getAttribute('normal').array.buffer);
const indexBytes = Buffer.from(new Uint32Array(indices).buffer);
const bin = Buffer.concat([positionBytes, normalBytes, indexBytes]);
const output = {
  asset: { version: '2.0', generator: 'HardGainWAF head extraction', copyright: 'BodyParts3D © DBCLS; modified by open-anatomy-3d and HardGainWAF. CC BY 4.0.' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Neutral human head', mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'Neutral surface', pbrMetallicRoughness: { baseColorFactor: [0.65, 0.68, 0.7, 1], roughnessFactor: 0.8, metallicFactor: 0 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positionBytes.length }, { buffer: 0, byteOffset: positionBytes.length, byteLength: normalBytes.length }, { buffer: 0, byteOffset: positionBytes.length + normalBytes.length, byteLength: indexBytes.length }],
  accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [Math.min(...positions.filter((_, i) => i % 3 === 0)), Math.min(...positions.filter((_, i) => i % 3 === 1)), Math.min(...positions.filter((_, i) => i % 3 === 2))], max: [Math.max(...positions.filter((_, i) => i % 3 === 0)), Math.max(...positions.filter((_, i) => i % 3 === 1)), Math.max(...positions.filter((_, i) => i % 3 === 2))] }, { bufferView: 1, componentType: 5126, count: positions.length / 3, type: 'VEC3' }, { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' }],
};
const rawJson = Buffer.from(JSON.stringify(output));
const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 32)]);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync('.tools', { recursive: true });
fs.writeFileSync('.tools/bodyparts-head-reference.glb', Buffer.concat([header, json, binHeader, bin]));
console.log(JSON.stringify({ sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), vertices: used.size, triangles: indices.length / 3, bytes: 28 + json.length + bin.length }));
