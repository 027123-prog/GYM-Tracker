import { MUSCLE_GROUPS } from './exerciseMuscles.js';
import { chestSurfaceRegion } from './chestRegions.js';
import { projectDeepRegion } from './deepMuscleProjection.js';

// IDs are stored in the prepared model, independent of triangle ordering.
export const DIEGO_REGION_IDS = ['context', ...Object.keys(MUSCLE_GROUPS)];
export const DIEGO_ASSET_REVISION = 'coverage-2';
export const DIEGO_COVERAGE = Object.fromEntries(Object.keys(MUSCLE_GROUPS).map(id => [id,
  id === 'chest' ? 'aggregate' : ['spinal_erectors', 'hip_flexors'].includes(id) ? 'projection' : 'surface',
]));

const pairs = (id, ...values) => values.includes(id);
const smooth = (value, low, high) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const one = id => [id, id, 0];

// Connected source pieces were inspected in front/back/side views. These
// component IDs apply to the pinned, hash-checked source, not arbitrary meshes.
// The source fuses the three deltoid heads and trapezius subdivisions; only
// these structures and the three chest regions use illustrative soft borders.
export function classifyDiegoPart(material, component, bounds, point, normal) {
  return projectDeepRegion(classifySurface(material, component, bounds, point), material, point, normal);
}

function classifySurface(material, component, bounds, point) {
  const [x, y, z] = point;
  if (material === 'defaultMat_3') {
    if (pairs(component, 22450, 22359)) return chestSurfaceRegion(x,y);
    if (pairs(component, 22593, 22459)) return one('abs');
    return one('obliques');
  }
  if (material === 'defaultMat_12') return one(pairs(component, 8197, 8385) ? 'glutes' : 'hip_abductors');
  if (material === 'defaultMat_11') {
    if (pairs(component, 18897, 18900)) {
      const axis = -0.075;
      if (z > axis) return ['lateral_delts', 'front_delts', smooth(z, axis + 0.008, axis + 0.055)];
      return ['lateral_delts', 'rear_delts', 1 - smooth(z, axis - 0.055, axis - 0.008)];
    }
    if (pairs(component, 18928, 18927)) return one('lats'); // teres major
    return one('external_rotators'); // infraspinatus / teres minor
  }
  if (material === 'defaultMat_8') {
    if (pairs(component, 31101, 31104)) return one('lats');
    if (pairs(component, 31042, 31056)) return ['upper_back', 'upper_traps', smooth(y, 1.48, 1.55)];
    if (pairs(component, 31088, 31089)) return one('upper_back');
    return one('serratus'); // visible serratus slips at the lateral rib cage
  }
  if (material === 'defaultMat') return one(pairs(component, 17007, 17030) ? 'triceps' : 'elbow_flexors');
  if (material === 'defaultMat_0') {
    if (pairs(component, 26283, 26295)) return one('brachioradialis');
    if (pairs(component, 26204, 26196)) return one('triceps'); // anconeus
    if (pairs(component, 26290, 26286, 26278, 26282, 26289, 26311, 25934, 26261)) return one('forearm_flexors');
    return one('forearm_extensors');
  }
  if (material === 'defaultMat_4') return one('context'); // small deep forearm / intrinsic hand pieces
  if (material === 'defaultMat_6') return one(pairs(component, 16137, 16245) ? 'context' : 'quads'); // sartorius stays neutral
  if (material === 'defaultMat_9') return one('hamstrings');
  if (material === 'defaultMat_1') return one('adductors');
  if (material === 'defaultMat_10') return one('calves');
  if (material === 'defaultMat_2') return one(pairs(component, 21084, 21085) ? 'tibialis' : 'context');
  return one('context'); // skeleton, tendons, face and untracked neck muscles
}
