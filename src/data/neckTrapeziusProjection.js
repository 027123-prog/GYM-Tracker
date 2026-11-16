const smooth = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// Schematic continuation over the replacement head's posterior neck, where
// the source anatomy was clipped. This is not a newly dissected muscle surface.
// Leave the throat, face, ears and skull outside the training-color mask.
export function neckTrapeziusWeight(position, normal) {
  const [x, y, z] = position;
  const nz = normal?.[2];
  if (![x, y, z, nz].every(Number.isFinite)) return 0;
  const height = smooth(1.58, 1.608, y) * (1 - smooth(1.67, 1.735, y));
  const width = 0.078 - 0.016 * smooth(1.62, 1.73, y);
  const lateral = 1 - smooth(width * 0.65, width, Math.abs(x));
  const midline = smooth(0.003, 0.009, Math.abs(x));
  const posterior = (1 - smooth(-0.06, -0.025, z)) * smooth(0.1, 0.7, -nz);
  return height * lateral * midline * posterior;
}
