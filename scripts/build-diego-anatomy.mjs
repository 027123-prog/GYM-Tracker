import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { DIEGO_REGION_IDS, DIEGO_ASSET_REVISION, classifyDiegoPart } from '../src/data/diegoAnatomy.js';

const sourceDir = path.resolve(process.argv[2] || '.tools/diego-source');
const outputDir = path.resolve('public/anatomy');
const json = JSON.parse(await fs.readFile(path.join(sourceDir, 'scene.gltf'), 'utf8'));
const binary = await fs.readFile(path.join(sourceDir, 'scene.bin'));
const gitHash = crypto.createHash('sha1').update(Buffer.from(`blob ${binary.length}\0`)).update(binary).digest('hex');
if (gitHash !== '71b2f537687dcf821e8d82e030237b68f9042364') throw new Error('Unexpected source geometry; component IDs must be reviewed again');
const sceneJson = structuredClone(json);
sceneJson.buffers[0].uri = 'data:application/octet-stream;base64,' + binary.toString('base64');
sceneJson.materials = json.materials.map(m => ({ name: m.name, pbrMetallicRoughness: { baseColorFactor: [1,1,1,1] } }));
delete sceneJson.images; delete sceneJson.textures; delete sceneJson.samplers;
globalThis.ProgressEvent = class { constructor(type, values) { this.type=type; Object.assign(this,values); } };
const source = await new GLTFLoader().parseAsync(JSON.stringify(sceneJson), '');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
source.scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(source.scene), center = box.getCenter(new THREE.Vector3());
const scale = 1.88 / (box.max.y - box.min.y);
const normalize = new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z));
const out = { asset: { version:'2.0', generator:'HardGainWAF Diego anatomy preparation', copyright:'Male Full Body Ecorche by Diego Luján García, CC BY 4.0', extras:{source:json.asset.extras, regionIds:DIEGO_REGION_IDS, assetRevision:DIEGO_ASSET_REVISION} },
  extensionsUsed:['EXT_meshopt_compression'], extensionsRequired:['EXT_meshopt_compression'],
  scene:0, scenes:[{nodes:[]}], nodes:[], meshes:[], materials:[], images:[], textures:[], samplers:json.samplers,
  buffers:[{byteLength:0},{byteLength:0,extensions:{EXT_meshopt_compression:{fallback:true}}}], bufferViews:[], accessors:[] };
const chunks=[], report=[], imageCache=new Map(), materialCache=new Map();
let offset=0, decodedOffset=0, maxError=0;
function append(bytes){const start=offset;const data=Buffer.from(bytes);chunks.push(data);offset+=data.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return start;}
function accessor(array,type,count,componentType,size,mode='ATTRIBUTES',filter='NONE',extra={}){
 let input=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
 if(filter==='EXPONENTIAL')input=MeshoptEncoder.encodeFilterExp(array,count,size,type==='VEC2'?18:20,'Separate');
 const compressed=MeshoptEncoder.encodeGltfBuffer(input,count,size,mode,0);
 const decoded=new Uint8Array(count*size);MeshoptDecoder.decodeGltfBuffer(decoded,count,size,compressed,mode,filter);
 if(componentType===5126){const values=new Float32Array(decoded.buffer);for(let i=0;i<values.length;i++)maxError=Math.max(maxError,Math.abs(values[i]-array[i]));}
 const byteOffset=append(compressed),view=out.bufferViews.length;
 out.bufferViews.push({buffer:1,byteOffset:decodedOffset,byteLength:count*size,...(mode==='ATTRIBUTES'?{byteStride:size}:{}),extensions:{EXT_meshopt_compression:{buffer:0,byteOffset,byteLength:compressed.length,byteStride:size,count,mode,...(filter!=='NONE'?{filter}:{})}}});
 decodedOffset+=count*size;
 const id=out.accessors.length;out.accessors.push({bufferView:view,componentType,count,type,...extra});return id;
}
async function image(textureIndex){
 const oldTexture=json.textures[textureIndex], oldImage=json.images[oldTexture.source];
 if(imageCache.has(oldImage.uri))return imageCache.get(oldImage.uri);
 const imagePath=path.resolve(sourceDir,oldImage.uri);if(!imagePath.startsWith(sourceDir+path.sep))throw new Error('Invalid image path');
 const bytes=await sharp(imagePath).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();
 const view=out.bufferViews.length;out.bufferViews.push({buffer:0,byteOffset:append(bytes),byteLength:bytes.length});
 const imageId=out.images.length;out.images.push({bufferView:view,mimeType:'image/jpeg',name:oldImage.uri});
 const id=out.textures.length;out.textures.push({source:imageId,...(oldTexture.sampler===undefined?{}:{sampler:oldTexture.sampler})});imageCache.set(oldImage.uri,id);return id;
}
async function material(name){
 if(materialCache.has(name))return materialCache.get(name);
 const m=structuredClone(json.materials.find(m=>m.name===name));
 m.pbrMetallicRoughness.metallicFactor=0;m.pbrMetallicRoughness.roughnessFactor=.68;
 if(m.pbrMetallicRoughness.baseColorTexture)m.pbrMetallicRoughness.baseColorTexture.index=await image(m.pbrMetallicRoughness.baseColorTexture.index);
 if(m.normalTexture){m.normalTexture.index=await image(m.normalTexture.index);m.normalTexture.scale=.65;}
 const id=out.materials.length;out.materials.push(m);materialCache.set(name,id);return id;
}

const objects=[];source.scene.traverse(o=>{if(o.isMesh)objects.push(o);});
for(const object of objects){
 if(object.material.name==='defaultMat_7')continue;
 const g=object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize,object.matrixWorld));
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),index=g.getIndex();
 const parents=Array.from({length:p.count},(_,i)=>i),weld=new Map();
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');if(weld.has(key))union(i,weld.get(key));else weld.set(key,i);}
 for(let i=0;i<index.count;i+=3){union(index.getX(i),index.getX(i+1));union(index.getX(i),index.getX(i+2));}
 const bounds=new Map();for(let i=0;i<p.count;i++){const id=find(i),b=bounds.get(id)||new THREE.Box3();b.expandByPoint(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));bounds.set(id,b);}
 const positions=[],normals=[],uvs=[],training=[],indices=[],used=new Map(),regions=new Set();
 const vertex=i=>({key:`v${i}`,p:[p.getX(i),p.getY(i),p.getZ(i)],n:[n.getX(i),n.getY(i),n.getZ(i)],uv:[uv?.getX(i)||0,uv?.getY(i)||0],component:find(i)});
 function add(v){if(used.has(v.key))return used.get(v.key);const id=positions.length/3;used.set(v.key,id);positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);
 const [a,b,mix]=classifyDiegoPart(object.material.name,v.component,bounds.get(v.component),v.p,v.n);regions.add(a);regions.add(b);training.push(DIEGO_REGION_IDS.indexOf(a),DIEGO_REGION_IDS.indexOf(b),Math.round(mix*255),0);return id;}
 function cut(a,b){const t=(1.615-a.p[1])/(b.p[1]-a.p[1]);return{key:[a.key,b.key].sort().join(':'),p:a.p.map((v,i)=>i===1?1.615:v+t*(b.p[i]-v)),n:a.n.map((v,i)=>v+t*(b.n[i]-v)),uv:a.uv.map((v,i)=>v+t*(b.uv[i]-v)),component:a.component};}
 for(let i=0;i<index.count;i+=3){const vs=[vertex(index.getX(i)),vertex(index.getX(i+1)),vertex(index.getX(i+2))],polygon=[];for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],ina=a.p[1]<=1.615,inb=b.p[1]<=1.615;if(ina)polygon.push(a);if(ina!==inb)polygon.push(cut(a,b));}for(let j=1;j+1<polygon.length;j++)indices.push(add(polygon[0]),add(polygon[j]),add(polygon[j+1]));}
 if(!indices.length)continue;
 const triangleArray=Uint32Array.from(indices),[remap,count]=MeshoptEncoder.reorderMesh(triangleArray,true,true);
 function reorder(values,stride,Type){const target=new Type(count*stride);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let j=0;j<stride;j++)target[remap[i]*stride+j]=values[i*stride+j];return target;}
 const ps=reorder(positions,3,Float32Array),ns=reorder(normals,3,Float32Array),us=reorder(uvs,2,Float32Array),ts=reorder(training,4,Uint8Array);
 const bb=new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(ps,3));
 const attrs={POSITION:accessor(ps,'VEC3',count,5126,12,'ATTRIBUTES','EXPONENTIAL',{min:bb.min.toArray(),max:bb.max.toArray()}),NORMAL:accessor(ns,'VEC3',count,5126,12,'ATTRIBUTES','EXPONENTIAL'),TEXCOORD_0:accessor(us,'VEC2',count,5126,8,'ATTRIBUTES','EXPONENTIAL'),_TRAINING:accessor(ts,'VEC4',count,5121,4)};
 const ix=count<65536?Uint16Array.from(triangleArray):triangleArray;
 const indexId=accessor(ix,'SCALAR',ix.length,count<65536?5123:5125,count<65536?2:4,'TRIANGLES');
 const node=out.nodes.length;out.scenes[0].nodes.push(node);out.nodes.push({name:object.material.name,mesh:out.meshes.length,extras:{regions:[...regions],sourceMaterial:object.material.name}});
 out.meshes.push({primitives:[{attributes:attrs,indices:indexId,material:await material(object.material.name)}]});
 report.push({material:object.material.name,vertices:count,triangles:ix.length/3,regions:[...regions]});g.dispose();
}
out.buffers[0].byteLength=offset;out.buffers[1].byteLength=decodedOffset;
const jsonBytes=Buffer.from(JSON.stringify(out)),jsonChunk=Buffer.concat([jsonBytes,Buffer.alloc((4-jsonBytes.length%4)%4,32)]),binChunk=Buffer.concat(chunks);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binChunk.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binChunk.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,jsonChunk,binHeader,binChunk]);
await fs.mkdir(outputDir,{recursive:true});await fs.writeFile(path.join(outputDir,'diego-training.glb'),result);
await fs.writeFile(path.join(outputDir,'diego-manifest.json'),JSON.stringify({source:json.asset.extras,sourceGitBlob:gitHash,sha256:crypto.createHash('sha256').update(result).digest('hex'),bytes:result.length,assetRevision:DIEGO_ASSET_REVISION,regionIds:DIEGO_REGION_IDS,meshes:report,maxAttributeRoundtripError:maxError,notes:['Source form and triangle detail retained; exposed face removed for separate neutral head','Textures resized to 1024 pixels; baked source normal maps retained','Artist surface groups; upper/middle/lower chest, deltoid heads and trapezius subdivisions use illustrative soft boundaries','Light tendon pixels within assigned muscles receive the muscle tint in the application shader','Lumbar spinal erectors and deep hip flexors are schematic bilateral color projections on existing geometry, not exposed muscle anatomy','Visible serratus slips have their own training region']},null,2));
console.log(JSON.stringify({bytes:result.length,triangles:report.reduce((n,m)=>n+m.triangles,0),maxAttributeRoundtripError:maxError,meshes:report.length}));
