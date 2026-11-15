// Unitless relative emphasis for the visualization, not measured activation,
// isolation or a prediction of regional hypertrophy. Every profile retains
// contributions to all three regions. The parent chest load is not changed.
export const CHEST_REGION_LABELS = {
  chest_upper: 'Obere Brust',
  chest_middle: 'Mittlere Brust',
  chest_lower: 'Untere Brust',
};

export const CHEST_LOAD_PROFILES = {
  flat: { chest_upper: 0.8, chest_middle: 1, chest_lower: 0.9 },
  incline: { chest_upper: 1, chest_middle: 0.75, chest_lower: 0.5 },
  decline: { chest_upper: 0.5, chest_middle: 0.8, chest_lower: 1 },
  unspecified: { chest_upper: 1, chest_middle: 1, chest_lower: 1 },
};

const nameKey = (name = '') => name.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
const aliases = new Map(Object.entries({
  flat: ['Bankdrücken', 'Bankdrücken Stange', 'Bankdrücken - Hantel'],
  incline: ['Schrägbankdrücken Stange', 'schrägbankdrücken hantel'],
  decline: ['Negativbankdrücken', 'Negativbankdrücken Stange', 'Negativbankdrücken Hantel'],
  // Dips depend on posture, and the seated dip machine is not a decline press.
  // The plate chest press name does not establish its backrest/press angle.
  unspecified: ['Dips', 'dip plate', 'bankdrücken - Plate'],
}).flatMap(([profile, names]) => names.map(name => [nameKey(name), profile])));

export function resolveChestProfile(assignment, exerciseName) {
  if (assignment.chestProfile !== undefined) {
    return Object.hasOwn(CHEST_LOAD_PROFILES, assignment.chestProfile) ? assignment.chestProfile : 'unspecified';
  }
  return aliases.get(nameKey(exerciseName)) || 'unspecified';
}

// Curved borders converge towards the humeral attachment, following the fan
// of the approved sculpt. Only colors are divided; no geometry is deformed.
export function chestSurfaceRegion(x, y) {
  const lateral = Math.max(0, Math.min(1, Math.abs(x) / 0.22));
  const upperBoundary = 1.49 - 0.025 * lateral;
  const lowerBoundary = 1.395 + 0.060 * lateral;
  const halfWidth = Math.min(0.008, (upperBoundary - lowerBoundary) / 2);
  const smooth = (low, high) => {
    const t = Math.max(0, Math.min(1, (y - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  if (y >= (upperBoundary + lowerBoundary) / 2) {
    return ['chest_middle', 'chest_upper', smooth(upperBoundary - halfWidth, upperBoundary + halfWidth)];
  }
  return ['chest_lower', 'chest_middle', smooth(lowerBoundary - halfWidth, lowerBoundary + halfWidth)];
}
