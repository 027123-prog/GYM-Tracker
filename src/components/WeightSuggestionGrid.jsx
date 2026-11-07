import { getWeightSuggestionKey } from '../utils/weightSuggestions';

export default function WeightSuggestionGrid({ options, selectedValue, onSelect, perWeight = false }) {
  if (!options.length) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{perWeight ? 'Bekannte Einzelgewichte' : 'Bekannte Gewichte'}</p>
      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((weight) => {
          const selected = getWeightSuggestionKey(selectedValue) === getWeightSuggestionKey(weight);

          return (
            <button
              key={weight}
              type="button"
              onClick={() => onSelect(weight)}
              className={`min-h-10 rounded-sm border px-3 py-2 text-sm font-bold transition ${
                selected
                  ? 'border-amber bg-amber-soft text-amber-deep'
                  : 'border-line bg-paper text-muted hover:border-amber/60 hover:text-amber-deep'
              }`}
              aria-pressed={selected}
            >
              {typeof weight === 'number' ? weight.toLocaleString('de-DE') : weight} kg{perWeight ? ' je' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
