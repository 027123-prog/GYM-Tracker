import { getWeightSuggestionKey } from '../utils/weightSuggestions';
import QuickEntryTile from './QuickEntryTile';

export default function WeightSuggestionGrid({ options, selectedValue, onSelect, label = 'Gewicht', editControl, allowNegative = false }) {
  const getKey = (value) => getWeightSuggestionKey(value, { allowNegative });
  const selectedKey = getKey(selectedValue);
  const hasSelectedTile = options.some((option) => getKey(option) === selectedKey);
  const weights = selectedKey !== null && !hasSelectedTile ? [...options, selectedValue] : options;

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-muted">{label}</p>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        {editControl}
        {weights.map((weight) => (
          <QuickEntryTile
            key={weight}
            selected={selectedKey !== null && getKey(weight) === selectedKey}
            onClick={() => onSelect(weight)}
          >
            {typeof weight === 'number' ? weight.toLocaleString('de-DE') : weight} kg
          </QuickEntryTile>
        ))}
      </div>
    </div>
  );
}
