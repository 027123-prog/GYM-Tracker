// Schematic surface projections of covered muscles. They communicate a deep
// training region without pretending that fascia/skin is an exposed muscle.
const smooth = (value, low, high) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

export function lumbarProjection([x, y, z], normal = [0, 0, -1]) {
  if (z > -0.045 || normal[2] > -0.15) return 0;
  const height = smooth(y, 1.065, 1.105) * (1 - smooth(y, 1.265, 1.315));
  const center = 0.041 + Math.max(0, Math.min(1, (y - 1.09) / 0.2)) * 0.018;
  const distance = Math.abs(Math.abs(x) - center);
  const column = 1 - smooth(distance, 0.018, 0.041);
  const midline = smooth(Math.abs(x), 0.012, 0.024);
  return height * column * midline;
}

export function hipFlexorProjection([x, y, z], normal = [0, 0, 1]) {
  if (z < 0.025 || normal[2] < 0.15) return 0;
  const height = smooth(y, 0.9, 0.94) * (1 - smooth(y, 1.045, 1.085));
  const center = 0.055 + Math.max(0, Math.min(1, (y - 0.93) / 0.13)) * 0.042;
  return height * (1 - smooth(Math.abs(Math.abs(x) - center), 0.011, 0.03));
}

export function projectDeepRegion(base, material, position, normal) {
  const lumbar = material === 'defaultMat_8' && base[0] === 'lats'
    ? lumbarProjection(position, normal) : 0;
  if (lumbar > 0) return [base[0], 'spinal_erectors', lumbar];
  const hip = ['defaultMat_3', 'defaultMat_6'].includes(material)
    && ['abs', 'obliques', 'context'].includes(base[0]) ? hipFlexorProjection(position, normal) : 0;
  if (hip > 0) return [base[0], 'hip_flexors', hip];
  return base;
}
