import { MathUtils, Matrix3, Vector3 } from 'three';

const smooth = MathUtils.smoothstep;

// The clipping plane follows the underside of the jaw and rises toward the nape.
export const neckCutDistance = ([, y, z]) => y + 0.47 * z - 1.635;

// Work in the normalized source coordinates, before quantization. Use one
// continuous displacement for skin, muscle, tendon and bone at shared seams.
export function shapeTrainingPoint([x, y, z]) {
  const side = Math.abs(x);
  if (y > 1.53 && side < 0.14) {
    const neck = smooth(y, 1.53, 1.63) * (1 - smooth(side, 0.11, 0.14));
    const depth = smooth(-z, 0.012, 0.071);
    const top = smooth(neckCutDistance([x, y, z]), -0.055, 0) * (1 - smooth(side, 0.11, 0.14));
    return [x * (1 + neck * 0.19 - 0.40 * top), y,
      -0.043 + (z + 0.043) * (1 - top * 0.46) - 0.017 * neck * depth * (1 - 0.75 * top)];
  }
  if (side > 0.14 && y > 0.64 && y < 1.56) {
    const shoulder = smooth(y, 1.30, 1.48);
    const weight = smooth(side, 0.201 - 0.057 * shoulder, 0.249 - 0.028 * shoulder)
      * (1 - smooth(y, 1.515, 1.56)) * smooth(y, 0.64, 0.68);
    if (weight > 0) {
      const angle = MathUtils.degToRad(6) * weight;
      const dx = side - 0.193, dy = y - 1.505;
      return [Math.sign(x) * (0.193 + dx * Math.cos(angle) - dy * Math.sin(angle)),
        1.505 + dx * Math.sin(angle) + dy * Math.cos(angle), z];
    }
  }
  if (y > 1.055 && y < 1.315 && side < 0.103 && z < -0.052) {
    const height = smooth(y, 1.055, 1.125) * (1 - smooth(y, 1.24, 1.315));
    const center = 0.041 + 0.018 * MathUtils.clamp((y - 1.09) / 0.2, 0, 1);
    const crossSection = Math.max(0, 1 - ((side - center) / 0.036) ** 2);
    const relief = 0.009 * height * crossSection ** 2 * smooth(-z, 0.052, 0.083);
    return [x, y, z - relief];
  }
  return [x, y, z];
}

// Carry the sculpt's original smooth normals through the same local deformation.
// Recomputing triangle normals would expose the original UV splits.
export function shapeTrainingVertex(point, normal) {
  const position = shapeTrainingPoint(point);
  if (position.every((value, axis) => Math.abs(value - point[axis]) < 1e-10)) return { position, normal };
  const step = 0.00005;
  const columns = point.map((_, axis) => {
    const low = [...point], high = [...point];
    low[axis] -= step;
    high[axis] += step;
    const a = shapeTrainingPoint(low), b = shapeTrainingPoint(high);
    return b.map((value, i) => (value - a[i]) / (2 * step));
  });
  const normalMatrix = new Matrix3().fromArray(columns.flat()).invert().transpose();
  return { position, normal: new Vector3(...normal).applyMatrix3(normalMatrix).normalize().toArray() };
}
