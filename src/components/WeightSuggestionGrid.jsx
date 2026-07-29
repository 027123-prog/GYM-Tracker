export default function WeightSuggestionGrid({ options, onSelect }) {
  if (!options.length) {
    return null;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">Bekannte Gewichte</p>
      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
      {options.map((weight) => (
        <button
          key={weight}
          type="button"
          onClick={() => onSelect(weight)}
          className="min-h-10 rounded-sm border border-line bg-paper px-3 py-2 text-sm font-bold text-muted transition hover:border-amber/60 hover:text-amber-deep"
        >
          {weight} kg
        </button>
      ))}
      </div>
    </div>
  );
}
