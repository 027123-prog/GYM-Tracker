import { calculateBodyweightLoad, parseLocalizedNumber } from './bodyweight';

const decimalPattern = '(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
const singleWeight = new RegExp(`^[+-]?${decimalPattern}$`);
const multipliedWeight = new RegExp(`^([1-9]\\d*)[xX×*](${decimalPattern})$`);
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

export function parseWeightInput(value, { allowNegative = false } = {}) {
  const input = String(value ?? '').trim().replace(/\s+/g, '');
  const multiplied = input.match(multipliedWeight);
  const weight = multiplied
    ? Number(multiplied[1]) * Number(multiplied[2].replace(',', '.'))
    : singleWeight.test(input) ? Number(input.replace(',', '.')) : Number.NaN;

  if (!Number.isFinite(weight) || (!allowNegative && weight < 0) || Math.abs(weight) > 2000) {
    return null;
  }

  return {
    weight: multiplied ? Number(weight.toFixed(10)) : weight,
    ...(multiplied ? { weightInput: `${multiplied[1]}x${multiplied[2]}` } : {}),
  };
}

export function isDurationSet(setItem) {
  return setItem?.measurementType === 'duration';
}

export function isWeightlessSet(setItem) {
  return setItem?.weightMode === 'none';
}

export function prepareSetValues(payload) {
  const duration = isDurationSet(payload);
  const quantity = parseLocalizedNumber(duration ? payload.durationSeconds : payload.reps);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > (duration ? 86400 : 1000)) {
    return {
      error: duration
        ? 'Dauer muss eine ganze Zahl zwischen 1 und 86.400 Sekunden sein.'
        : 'Wiederholungen müssen eine ganze Zahl zwischen 1 und 1.000 sein.',
    };
  }

  let load;

  if (isWeightlessSet(payload)) {
    load = { weight: 0, weightMode: 'none' };
  } else if (payload.weightMode === 'bodyweight') {
    const bodyWeight = parseLocalizedNumber(payload.bodyWeight);
    const bodyweightFactor = parseLocalizedNumber(payload.bodyweightFactor);
    const added = parseWeightInput(payload.addedWeightInput ?? payload.addedWeight ?? 0, { allowNegative: true });
    const weight = added ? calculateBodyweightLoad(bodyWeight, bodyweightFactor, added.weight) : null;

    if (weight === null) {
      return { error: 'Bitte Körpergewicht, Anteil und Zusatzgewicht prüfen.' };
    }

    load = {
      weight,
      weightMode: 'bodyweight',
      bodyWeight,
      bodyweightFactor,
      addedWeight: added.weight,
      ...(added.weightInput ? { addedWeightInput: added.weightInput } : {}),
    };
  } else {
    load = parseWeightInput(payload.weightInput ?? payload.weight);

    if (!load) {
      return { error: 'Gewicht: 0 bis 2.000 kg, z. B. 30 oder 2x30.' };
    }
  }

  return {
    error: null,
    values: {
      ...load,
      ...(duration
        ? { measurementType: 'duration', durationSeconds: quantity, reps: 0 }
        : { reps: quantity }),
    },
  };
}

export function formatSetWeight(setItem) {
  if (isWeightlessSet(setItem)) return '';
  const expression = parseWeightInput(setItem?.weightInput);
  return expression?.weightInput && expression.weight === Number(setItem.weight)
    ? `${expression.weightInput} kg`
    : `${numberFormat.format(Number(setItem?.weight) || 0)} kg`;
}

export function formatSetSummary(setItem) {
  if (isDurationSet(setItem)) {
    return `${setItem.durationSeconds} s${!isWeightlessSet(setItem) && Number(setItem.weight) ? ` · ${formatSetWeight(setItem)}` : ''}`;
  }

  if (isWeightlessSet(setItem)) return `${setItem.reps} Wdh.`;
  return `${formatSetWeight(setItem)} × ${setItem.reps}`;
}

export function getSetRepVolume(setItem) {
  return isDurationSet(setItem) || isWeightlessSet(setItem) ? 0 : Number(setItem.weight || 0) * Number(setItem.reps || 0);
}
