import { ACESFilmicToneMapping, DirectionalLight, HemisphereLight, SRGBColorSpace } from 'three';

export function fitFigureCamera(camera, width, height) {
  // The open hands need a little extra room in narrow dashboard columns.
  const aspect = width / height;
  const halfHeight = Math.max(1.015, 0.47 / aspect);
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.right = halfHeight * aspect;
  camera.left = -camera.right;
  camera.updateProjectionMatrix();
}

export function lightMuscleFigure(renderer, scene) {
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  scene.add(new HemisphereLight('#f1f3f3', '#666b6d', 1.7));
  const key = new DirectionalLight('#fffaf6', 1.52);
  key.position.set(-2, 3.5, 3);
  const rim = new DirectionalLight('#e3e9eb', 0.95);
  rim.position.set(2, 2, -2);
  scene.add(key, rim);
}
