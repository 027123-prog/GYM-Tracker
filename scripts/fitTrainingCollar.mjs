import { DoubleSide, MathUtils, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createNeutralHeadGeometry } from '../src/components/muscle/neutralHead.js';

// Fit the original muscle tips to the same surface the app will render.
// Only the offline builder pays for the intersection tests.
export function createCollarFitter(head) {
  const geometry = createNeutralHeadGeometry(head);
  const positions = geometry.getAttribute('position');
  const indices = geometry.index.array;
  const collar = [];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.subarray(i, i + 3);
    if (triangle.some(id => positions.getY(id) < 1.70)) collar.push(...triangle);
  }
  geometry.setIndex(collar);
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const ray = new Raycaster();
  const radial = new Vector3();

  return ({ position, normal }) => {
    const [x, y, z] = position;
    if (y < 1.55 || Math.abs(x) > 0.14) return { position, normal, blend: 0 };
    radial.set(x, 0, z + 0.045).normalize();
    ray.ray.origin.set(0, y, -0.045).addScaledVector(radial, 0.3);
    ray.ray.direction.copy(radial).negate();
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit) return { position, normal, blend: 0 };

    // Round the intersection outward. The quadratic joins the outer muscle
    // with its original slope and slips beneath the skin at a shallow angle.
    const gap = Math.hypot(x, z + 0.045) - (0.3 - hit.distance);
    const band = 0.007;
    const t = MathUtils.clamp((gap + band) / (2 * band), 0, 1);
    const offset = gap >= band ? 0 : 0.8 * (band * t * t - gap) * MathUtils.smoothstep(gap, -2 * band, -band);
    const blend = 1 - MathUtils.smoothstep(gap, -0.002, 0.016);
    const surfaceNormal = new Vector3(...normal).lerp(hit.normal.normalize(), blend).normalize();
    const shoulder = MathUtils.smoothstep(Math.atan2(Math.abs(x), -z - 0.045), 0.75, 1.5);
    return {
      position: [x + radial.x * offset, y, z + radial.z * offset],
      normal: surfaceNormal.toArray(),
      blend: Math.max(blend, MathUtils.smoothstep(y + shoulder * 0.012, 1.604, 1.625)),
    };
  };
}
