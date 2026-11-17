const smooth = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// A short, schematic continuation at the base of the replacement neck, where
// the anatomy was clipped. End just above the shoulder/neck junction; keep the
// upper neck, throat, face, ears and skull outside the training-color mask.
export function neckTrapeziusWeight(position, normal) {
  const [x, y, z] = position;
  const nz = normal?.[2];
  if (![x, y, z, nz].every(Number.isFinite)) return 0;
  const height = smooth(1.58, 1.605, y) * (1 - smooth(1.608, 1.625, y));
  const width = 0.078 - 0.016 * smooth(1.62, 1.73, y);
  const lateral = 1 - smooth(width * 0.65, width, Math.abs(x));
  const midline = smooth(0.003, 0.009, Math.abs(x));
  const posterior = (1 - smooth(-0.06, -0.025, z)) * smooth(0.1, 0.7, -nz);
  return height * lateral * midline * posterior;
}
