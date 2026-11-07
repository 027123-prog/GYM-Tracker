import { prepareSetValues } from './setMeasurements';

// Only reuse load, never the prior set's identity, time, duration or comment.
export function getTimerLoad(settings, latestSet) {
  const loadType = settings?.loadType ?? 'normal';
  const quantity = { measurementType: 'duration', durationSeconds: 1 };
  let load;
  if (loadType === 'none') {
    load = { weightMode: 'none' };
  } else if (loadType.startsWith('bodyweight')) {
    load = {
      weightMode: 'bodyweight',
      bodyWeight: latestSet?.weightMode === 'bodyweight' ? latestSet.bodyWeight : '',
      bodyweightFactor: Number(settings?.bodyweightPercent ?? 100) / 100,
      addedWeight: loadType === 'bodyweight-added' && latestSet?.weightMode === 'bodyweight' ? latestSet.addedWeight : 0,
    };
  } else {
    const compatible = latestSet && !['none', 'bodyweight'].includes(latestSet.weightMode);
    load = {
      weight: compatible ? latestSet.weight : 0,
      ...(loadType === 'paired' ? { weightMode: 'paired' } : {}),
    };
  }
  return prepareSetValues({ ...load, ...quantity }).values ?? null;
}
