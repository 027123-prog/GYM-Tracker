export default function WeightSuggestionGrid({ options, selectedValue, onSelect }) {
  if (!options.length) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Bekannte Gewichte</p>
      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((weight) => {
          const selected = Number(selectedValue) === Number(weight);

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
              {weight} kg
            </button>
          );
        })}
      </div>
    </div>
  );
}
