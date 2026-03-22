export default function WeightSuggestionGrid({ options, onSelect }) {
  if (!options.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((weight) => (
        <button
          key={weight}
          type="button"
          onClick={() => onSelect(weight)}
          className="rounded-2xl border border-pine/15 bg-mist px-3 py-2 text-sm font-semibold text-pine transition hover:border-pine"
        >
          {weight} kg
        </button>
      ))}
    </div>
  );
}
