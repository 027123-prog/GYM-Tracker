import * as THREE from 'three';

const gaussian = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));
const smooth = (value, low, high) => THREE.MathUtils.smoothstep(value, low, high);

// One continuous cage deformation is applied to muscles, skeleton and fascia
// together. This preserves their shared anatomical attachments while changing
// the presentation proportions; it is not a claim about the user's physique.
export function athleticPoint(x, y, z) {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const armAxis = y > 1.2 ? 0.252 - (y - 1.2) * 0.19
    : y > 1.1 ? 0.252 + (1.2 - y) * 0.07
    : y > 0.9 ? 0.259 + (1.1 - y) * 0.25 : 0.309;
  const armField = smooth(ax, armAxis - 0.07, armAxis - 0.04);
  // Palm and fingers move with the forearm as one region, rather than fading
  // back to the torso cage at each fingertip (which would stretch the hand).
  const handField = smooth(ax, 0.19, 0.225) * (1 - smooth(y, 1.10, 1.18));
  const anteriorChest = smooth(z, 0.025, 0.075) * (1 - smooth(ax, 0.19, 0.235)) * smooth(y, 1.25, 1.35);
  const arm = Math.max(armField, handField) * smooth(y, 0.60, 0.70) * (1 - smooth(y, 1.53, 1.63)) * (1 - anteriorChest);
  const armBulk = 0.55 * gaussian(y, 1.36, 0.14) + 0.20 * gaussian(y, 1.05, 0.12);
  const shoulderSpread = Math.max(0, 1.50 - y) * 0.20;
  const torso = (1 - arm) * smooth(y, 0.90, 1.04) * (1 - smooth(y, 1.51, 1.63));
  const upperBody = gaussian(y, 1.40, 0.17);
  let nx = ax + arm * ((ax - armAxis) * armBulk + shoulderSpread);
  nx += ax * torso * (0.17 * upperBody + 0.04 * gaussian(y, 1.02, 0.14));
  let nz = z + arm * (z + 0.035) * armBulk;
  nz += z * torso * (0.25 * upperBody + 0.10 * gaussian(y, 1.02, 0.14));
  const leg = (1 - arm) * (1 - smooth(ax, 0.19, 0.24)) * (1 - smooth(y, 1.00, 1.10));
  const legBulk = 0.25 * gaussian(y, 0.78, 0.20) + 0.13 * gaussian(y, 0.34, 0.13);
  nx += leg * (ax - 0.105) * legBulk * smooth(ax, 0.025, 0.07);
  nz += leg * z * legBulk;
  // The final neck ring retreats just inside the skin neck. This overlap
  // prevents a visible horizontal collar at the exact geometry cut.
  const neck = smooth(y, 1.575, 1.615) * (1 - smooth(ax, 0.075, 0.11));
  nx *= 1 - 0.25 * neck;
  nz = -0.025 + (nz + 0.025) * (1 - 0.30 * neck);
  return [sign * nx, y, nz];
}

// A shared abdominal wall: rectus and obliques use the same surface, with
// continuous positions AND normals at their border. Dimensions follow the
// source torso. Relief is illustrative, not an estimate of the user's body.
const wallRows = [
  [0.95, 0.150, 0.074, 0.025], [1.00, 0.164, 0.090, 0.045],
  [1.06, 0.149, 0.111, 0.063], [1.13, 0.137, 0.120, 0.070],
  [1.20, 0.143, 0.131, 0.074], [1.28, 0.155, 0.139, 0.077],
  [1.35, 0.158, 0.134, 0.071], [1.41, 0.154, 0.120, 0.048],
];

export function abdominalProfile(y) {
  let row = 0;
  while (row < wallRows.length - 2 && y > wallRows[row + 1][0]) row++;
  const a = wallRows[row], b = wallRows[row + 1];
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  // Cubic Hermite interpolation avoids steps in the waist silhouette.
  const sample = column => {
    const prev = wallRows[Math.max(0, row - 1)], next = wallRows[Math.min(wallRows.length - 1, row + 2)];
    const m0 = (b[column] - prev[column]) / (b[0] - prev[0]) * (b[0] - a[0]);
    const m1 = (next[column] - a[column]) / (next[0] - a[0]) * (b[0] - a[0]);
    return (2*t*t*t - 3*t*t + 1)*a[column] + (t*t*t - 2*t*t + t)*m0
      + (-2*t*t*t + 3*t*t)*b[column] + (t*t*t - t*t)*m1;
  };
  return { width: sample(1), front: sample(2), rectus: sample(3) };
}

export function abdominalPoint(theta, y) {
  const p = abdominalProfile(y);
  const x = p.width * Math.sin(theta), ax = Math.abs(x);
  const envelope = smooth(y, 0.96, 1.04) * (1 - smooth(y, 1.34, 1.405));
  const rectusMask = 1 - smooth(ax, p.rectus - 0.014, p.rectus + 0.006);
  const belly = Math.pow(Math.max(0, Math.sin(Math.PI * ax / p.rectus)), 0.7);
  const curvedY = y - 0.65 * x * x;
  const intersections = Math.max(...[1.305, 1.225, 1.137].map(h => gaussian(curvedY, h, 0.007)));
  const segmentFullness = 0.004 + 0.005 * gaussian(y, 1.265, 0.09) + 0.002 * gaussian(y, 1.17, 0.045);
  const relief = envelope * rectusMask * (segmentFullness * belly - 0.003 * intersections);
  const midline = 0.0035 * gaussian(x, 0, 0.0035) * envelope;
  const semilunar = 0.0025 * gaussian(ax, p.rectus, 0.004) * envelope;
  const navel = 0.004 * gaussian(x, 0, 0.007) * gaussian(y, 1.115, 0.009);
  const oblique = 0.004 * gaussian(ax, p.rectus + 0.035, 0.035) * gaussian(y, 1.15, 0.11);
  const z = -0.025 + (p.front + 0.025) * Math.cos(theta)
    + (relief - midline - semilunar - navel + oblique) * Math.max(0, Math.cos(theta));
  return [x, y, z];
}

// Move the source's overlapping anterior sheets just behind the common wall;
// the original lateral/posterior attachments remain present.
export function recessAbdominalSheet(x, y, z) {
  const p = abdominalProfile(y);
  const theta = Math.atan2(Math.abs(x) / p.width, (z + 0.025) / (p.front + 0.025));
  if (theta >= 1.90 || y < 0.95 || y > 1.41 || Math.abs(x) > 0.2) return [x, y, z];
  const low = 0.95 + 0.10 * Math.pow(Math.sin(theta), 1.5);
  const high = 1.405 - 0.025 * Math.sin(theta);
  const blend = smooth(y, low, low + 0.018) * (1 - smooth(y, high - 0.018, high)) * (1 - smooth(theta, 1.82, 1.90));
  const target = abdominalPoint(theta, y);
  const radius = Math.hypot(x, z + 0.025);
  const targetRadius = Math.hypot(target[0], target[2] + 0.025) - 0.009;
  const shrink = radius > targetRadius ? 1 + (targetRadius / radius - 1) * blend : 1;
  return [x * shrink, y, -0.025 + (z + 0.025) * shrink];
}

export function createAbdominalWall() {
  const pieces = [];
  for (const side of [-1, 1]) for (const region of ['abs', 'obliques']) {
    const positions = [], normals = [], uv = [], indices = [];
    const rows = 100, columns = region === 'abs' ? 28 : 38;
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      const t = row / rows, u = col / columns;
      // Boundary solved with the same y for both panels; no double seam.
      let y = 0.95 + t * 0.455;
      let theta;
      for (let iteration = 0; iteration < 4; iteration++) {
        const p = abdominalProfile(y);
        const border = Math.asin(p.rectus / p.width);
        theta = region === 'abs' ? u * border : border + u * (1.86 - border);
        const low = 0.95 + 0.10 * Math.pow(Math.sin(theta), 1.5);
        const high = 1.405 - 0.025 * Math.sin(theta);
        y = low + t * (high - low);
      }
      theta *= side;
      const point = abdominalPoint(theta, y);
      positions.push(...athleticPoint(...point));
      // Evaluate derivatives of the COMMON surface across panel boundaries.
      const epsilon = 0.0001;
      const a = new THREE.Vector3(...athleticPoint(...abdominalPoint(theta - epsilon, y)));
      const b = new THREE.Vector3(...athleticPoint(...abdominalPoint(theta + epsilon, y)));
      const c = new THREE.Vector3(...athleticPoint(...abdominalPoint(theta, y - epsilon)));
      const d = new THREE.Vector3(...athleticPoint(...abdominalPoint(theta, y + epsilon)));
      const normal = b.sub(a).cross(d.sub(c)).normalize();
      normals.push(...normal.toArray());
      const angle = region === 'abs' ? 0 : side * 0.65;
      uv.push(point[0]*Math.cos(angle) - y*Math.sin(angle), point[0]*Math.sin(angle) + y*Math.cos(angle));
      if (row && col) {
        const a = row * (columns + 1) + col, b = a - columns - 1;
        if (side > 0) indices.push(b - 1, b, a - 1, a - 1, b, a);
        else indices.push(b - 1, a - 1, b, a - 1, a, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    pieces.push({ region, geometry });
  }
  return pieces;
}
