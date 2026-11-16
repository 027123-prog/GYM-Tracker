// One display palette for calculations, previews and the 3D shader.
// The quiet zone is a visual choice, never a recovered/not-recovered threshold.
const NEUTRAL = [212, 218, 221];
const RED = [181, 11, 18];

export function muscleColorStrength(intensity) {
  const amount = typeof intensity === 'number' && Number.isFinite(intensity)
    ? Math.max(0, Math.min(1, intensity)) : 0;
  const strength = Math.max(0, (amount - 0.08) / 0.92) ** 1.25;
  // Compress the final color steps into full red without lifting the neutral
  // threshold or substantially amplifying tiny time-decayed residuals.
  return strength + 0.65 * strength ** 2 * (1 - strength);
}

export function muscleLoadColor(intensity) {
  const strength = muscleColorStrength(intensity);
  return `#${NEUTRAL.map((neutral, axis) => Math.round(neutral + (RED[axis] - neutral) * strength).toString(16).padStart(2, '0')).join('')}`;
}
