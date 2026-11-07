import { isDurationSet, isPairedSet, isWeightlessSet, parseWeightInput } from './setMeasurements';

export function getSetEntryLoadType(initialSet, settings) {
  const configured = settings?.loadType ?? 'normal';
  if (!initialSet) return configured;
  if (isWeightlessSet(initialSet)) return 'none';
  if (initialSet.weightMode === 'bodyweight') {
    return Number(initialSet.addedWeight) || configured === 'bodyweight-added' ? 'bodyweight-added' : 'bodyweight';
  }
  // Existing paired sets retain their meaning even after changing exercise settings.
  // Older normal sets can use the paired editor safely: their total is divided below.
  return isPairedSet(initialSet) || configured === 'paired' ? 'paired' : 'normal';
}

export function getSetEntryWeight(initialSet, loadType, duration = false) {
  if (!initialSet) return duration ? 0 : '';
  return loadType === 'paired'
    ? Number(initialSet.weight) / 2
    : initialSet.weightInput ?? initialSet.weight;
}

export function getSetEntryWeightSuggestions(options = [], configuredLoadType, entryLoadType) {
  const sourcePaired = configuredLoadType === 'paired';
  const targetPaired = entryLoadType === 'paired';
  if (sourcePaired === targetPaired) return options;
  return [...new Set(options.flatMap((option) => {
    const parsed = parseWeightInput(option);
    if (!parsed) return [];
    const total = parsed.weight * (sourcePaired ? 2 : 1);
    return [total / (targetPaired ? 2 : 1)];
  }))].sort((a, b) => a - b);
}

export function getRepeatedSetPayload(latest, settings) {
  if (!latest) return null;
  const measurementType = settings?.measurementType ?? 'reps';
  const configured = settings?.loadType ?? 'normal';
  const currentType = configured.startsWith('bodyweight') ? 'bodyweight' : configured;
  const latestType = isWeightlessSet(latest) ? 'none' : latest.weightMode === 'bodyweight' ? 'bodyweight' : 'normal';
  const compatibleType = currentType === 'paired' ? 'normal' : currentType;
  if ((isDurationSet(latest) ? 'duration' : 'reps') !== measurementType ||
      (currentType !== 'none' && latestType !== compatibleType)) return null;

  const quantity = {
    ...(measurementType === 'duration' ? { measurementType, durationSeconds: latest.durationSeconds, reps: 0 } : { reps: latest.reps }),
    comment: '',
  };
  if (currentType === 'none') return { ...quantity, weightMode: 'none', weight: 0 };
  return {
    ...quantity,
    weight: latest.weight,
    weightInput: isPairedSet(latest) && currentType === 'normal' ? undefined : latest.weightInput,
    weightMode: currentType === 'paired' ? 'paired' : latestType === 'bodyweight' ? 'bodyweight' : undefined,
    bodyWeight: latest.bodyWeight,
    bodyweightFactor: latest.bodyweightFactor,
    addedWeight: latest.addedWeight,
    addedWeightInput: latest.addedWeightInput,
  };
}
