export const BODYWEIGHT_FACTOR_PRESETS = [
  { label: '⅔', value: 2 / 3 },
  { label: '1×', value: 1 },
  { label: '1,5×', value: 1.5 },
];

export function parseLocalizedNumber(value) {
  const normalized = String(value).trim().replace(',', '.');

  if (normalized === '⅔') {
    return 2 / 3;
  }

  const fraction = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);

  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator ? numerator / denominator : Number.NaN;
  }

  return Number(normalized);
}

export function calculateBodyweightLoad(bodyWeight, factor, addedWeight = 0) {
  const parsedBodyWeight = parseLocalizedNumber(bodyWeight);
  const parsedFactor = parseLocalizedNumber(factor);
  const parsedAddedWeight = parseLocalizedNumber(addedWeight || 0);

  if (
    !Number.isFinite(parsedBodyWeight) ||
    parsedBodyWeight <= 0 ||
    !Number.isFinite(parsedFactor) ||
    parsedFactor <= 0 ||
    !Number.isFinite(parsedAddedWeight)
  ) {
    return null;
  }

  const effectiveWeight = parsedBodyWeight * parsedFactor + parsedAddedWeight;

  if (effectiveWeight < 0 || effectiveWeight > 2000) {
    return null;
  }

  return Math.round(effectiveWeight * 10) / 10;
}
