import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DIEGO_REGION_IDS, DIEGO_COVERAGE, DIEGO_ASSET_REVISION } from '../../data/diegoAnatomy';
import { createNeutralHeadGeometry } from './neutralHead';
import { muscleLoadColor } from '../../utils/muscleLoadColor';

const neutralColor = new THREE.Color(muscleLoadColor(0));
const NEUTRAL = [neutralColor.r, neutralColor.g, neutralColor.b];

// Shared palette changes colors without touching the approved sculpt, UVs,
// baked fibers or normal maps. Tendon-colored pixels within a muscle share
// that muscle's tint, so no white cutouts interrupt the colored surface.
function attachTrainingColors(material, palette) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uMusclePalette = { value: palette };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 _training;
      uniform vec3 uMusclePalette[${DIEGO_REGION_IDS.length}];
      varying vec3 vTrainingColor;
    `).replace('#include <begin_vertex>', `#include <begin_vertex>
      vTrainingColor = mix(uMusclePalette[int(_training.x)], uMusclePalette[int(_training.y)], _training.z / 255.0);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTrainingColor;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float grey = 0.63 + 0.37 * clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * 2.0, 0.0, 1.0);
        diffuseColor.rgb = grey * vTrainingColor;
      `);
  };
  material.customProgramCacheKey = () => 'diego-training-palette-3';
}

export async function createMuscleFigure() {
  const assetUrl = file => new URL(`${import.meta.env.BASE_URL}anatomy/${file}?v=${DIEGO_ASSET_REVISION}`, document.baseURI).href;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const results = await Promise.allSettled([loader.loadAsync(assetUrl('diego-training.glb')), loader.loadAsync(assetUrl('neutral-head.glb'))]);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const collect = object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  };
  const dispose = () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); };
  for (const result of results) if (result.status === 'fulfilled') result.value.scene.traverse(collect);
  if (results.some(result => result.status === 'rejected')) { dispose(); throw new Error('Anatomy asset could not be loaded'); }
  const [body, head] = results.map(result => result.value);
  if (body.asset?.extras?.assetRevision !== DIEGO_ASSET_REVISION || JSON.stringify(body.asset?.extras?.regionIds) !== JSON.stringify(DIEGO_REGION_IDS)) {
    dispose(); throw new Error('Anatomy palette and prepared model do not match');
  }
  const root = new THREE.Group();
  const palette = DIEGO_REGION_IDS.map(() => new THREE.Vector3(...NEUTRAL));
  const surfaceRegions = new Set();
  body.scene.traverse(object => {
    if (!object.isMesh) return;
    if (!object.geometry.getAttribute('_training')) { dispose(); throw new Error('Anatomy region attribute missing'); }
    for (const id of object.userData.regions || []) if (id !== 'context') surfaceRegions.add(id);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) attachTrainingColors(material, palette);
  });
  root.add(body.scene);
  head.scene.updateMatrixWorld(true);
  head.scene.traverse(object => {
    if (!object.isMesh) return;
    const source = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const geometry = createNeutralHeadGeometry(source); source.dispose(); geometries.add(geometry);
    const material = new THREE.MeshStandardMaterial({ color:'#a3adaf', roughness:0.78 }); materials.add(material);
    root.add(new THREE.Mesh(geometry,material));
  });
  return {
    root,
    muscleIds: [...surfaceRegions],
    coverage: DIEGO_COVERAGE,
    setLevels(muscles = {}) {
      DIEGO_REGION_IDS.forEach((id,index) => {
        // Only assigned muscles receive training colors. Light pixels within
        // those surfaces share the tint; unrelated support geometry stays grey.
        if (id === 'context') { palette[index].set(...NEUTRAL); return; }
        const value = Number(muscles[id]?.intensity);
        const intensity = Number.isFinite(value) ? THREE.MathUtils.clamp(value,0,1) : 0;
        // Consume the same display curve as the calculator, without a second
        // gamma boost that made tiny old contributions look freshly trained.
        const tint = new THREE.Color(muscleLoadColor(intensity));
        palette[index].set(tint.r,tint.g,tint.b);
        if (/^#[0-9a-f]{6}$/i.test(muscles[id]?.debugColor)) {
          const color = new THREE.Color(muscles[id].debugColor);
          palette[index].set(color.r,color.g,color.b);
        }
      });
    },
    dispose,
  };
}
