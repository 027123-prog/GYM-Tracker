import { useState } from 'react';

export default function ExerciseAutocomplete({ exercises, onAdd }) {
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (!value.trim()) {
      return;
    }

    onAdd(value);
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="exercise-name" className="mb-2 block text-sm font-semibold text-ink">
            Übung hinzufügen
          </label>
          <input
            id="exercise-name"
            className="field"
            list="exercise-library"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="z. B. Bankdrücken oder Rudern Kabel"
          />
          <datalist id="exercise-library">
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.name} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="action-button h-[50px] px-6">
          Hinzufügen
        </button>
      </div>
    </form>
  );
}
