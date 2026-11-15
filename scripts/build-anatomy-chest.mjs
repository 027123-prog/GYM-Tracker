import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const sourcePath = process.argv[2];
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
const normalize = new THREE.Matrix4().makeScale(scale, scale, scale)
  .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));

const output = {
  asset: { version: '2.0', generator: 'HardGainWAF chest extraction', copyright: 'BodyParts3D © DBCLS; modified by open-anatomy-3d and HardGainWAF. CC BY 4.0.' },
  scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
  materials: [{ name: 'Neutral chest', pbrMetallicRoughness: { baseColorFactor: [0.65, 0.68, 0.7, 1], roughnessFactor: 0.8, metallicFactor: 0 } }],
  buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
};
const chunks = [], report = [], compatibility = [];
let offset = 0;
function accessor(array, type, count, componentType, extra = {}) {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const view = output.bufferViews.length;
  output.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  chunks.push(bytes); offset += bytes.length;
  const id = output.accessors.length;
  output.accessors.push({ bufferView: view, componentType, count, type, ...extra });
  return id;
}
gltf.scene.traverse(object => {
  if (!object.isMesh) return;
  const isChest = /^chest_muscles_[lr]$/.test(object.name);
  if (!isChest && !/^(?:deltoid|upper_arm_muscles)_[lr]$/.test(object.name)) return;
  const original = object.geometry;
  const geometry = new THREE.BufferGeometry();
  // Decode normalized/quantized source attributes into Float32 before the
  // world transform; writing values above 1 into normalized Int16 would wrap.
  const sourcePosition = original.getAttribute('position');
  const decoded = new Float32Array(sourcePosition.count * 3);
  for (let i = 0; i < sourcePosition.count; i++) {
    decoded[i * 3] = sourcePosition.getX(i);
    decoded[i * 3 + 1] = sourcePosition.getY(i);
    decoded[i * 3 + 2] = sourcePosition.getZ(i);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(decoded, 3));
  if (original.getIndex()) geometry.setIndex(original.getIndex().clone());
  geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, object.matrixWorld));
  const welded = mergeVertices(geometry, 0.00001);
  geometry.dispose();
  welded.computeVertexNormals();
  welded.computeBoundingBox();
  const position = welded.getAttribute('position'), index = welded.getIndex();
  const box = welded.boundingBox;
  const details = { name: object.name, sourceVertices: original.getAttribute('position').count, vertices: position.count,
    triangles: index.count / 3, min: box.min.toArray(), max: box.max.toArray() };
  if (!isChest) { compatibility.push(details); welded.dispose(); return; }
  const side = object.name.endsWith('_l') ? 'left' : 'right';
  const positionId = accessor(Float32Array.from(position.array), 'VEC3', position.count, 5126, { min: box.min.toArray(), max: box.max.toArray() });
  const normalId = accessor(Float32Array.from(welded.getAttribute('normal').array), 'VEC3', position.count, 5126);
  const uvId = accessor(new Float32Array(position.count * 2), 'VEC2', position.count, 5126);
  const indexId = accessor(Uint32Array.from(index.array), 'SCALAR', index.count, 5125);
  const node = output.nodes.length;
  output.scenes[0].nodes.push(node);
  output.nodes.push({ name: object.name, mesh: output.meshes.length,
    extras: { key: 'pectoralis_major', muscleId: 'chest', region: 'chest', side, assetLicense: 'CC-BY-4.0', sourceName: object.name } });
  output.meshes.push({ primitives: [{ attributes: { POSITION: positionId, NORMAL: normalId, TEXCOORD_0: uvId }, indices: indexId, material: 0 }] });
  report.push(details);
  welded.dispose();
});
if (output.nodes.length !== 2) throw new Error('Expected exactly the two complete chest muscles');
output.buffers[0].byteLength = offset;
const bin = Buffer.concat(chunks);
const rawJson = Buffer.from(JSON.stringify(output));
const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, json, binHeader, bin]);
fs.writeFileSync('public/anatomy/chest-detail.glb', result);
console.log(JSON.stringify({ sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  sha256: crypto.createHash('sha256').update(result).digest('hex'), bytes: result.length, meshes: report, compatibility }, null, 2));
