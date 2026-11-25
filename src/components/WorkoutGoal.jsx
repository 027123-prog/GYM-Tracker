import { useState } from 'react';
import { formatNextGoalSet, formatWorkoutGoal, getGoalProgress, validWorkoutGoal } from '../utils/workoutGoals';


function GoalEditor({ goal, settings, onSave, onClose }) {
  const paired = goal.mode === 'paired';
  const weighted = goal.mode !== 'none' && (goal.mode !== 'bodyweight' || settings?.loadType === 'bodyweight-added');
  const [weight, setWeight] = useState(goal.load === null ? '' : String(paired ? goal.load / 2 : goal.load).replace('.', ','));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const unit = goal.duration ? 'Sekunden' : 'Wiederholungen';

  const kg = Number(weight.trim().replace(',', '.'));
  const load = weighted ? (paired ? kg * 2 : kg) : goal.load;
  const resetReps = !goal.duration && goal.load !== null && load > goal.load;

  function save(event) {
    event.preventDefault();
    let amounts = goal.amounts;
    if (resetReps) amounts = amounts.map(() => goal.min);
    else if (amount.trim()) amounts = amounts.map(() => Number(amount));
    else if (goal.duration && goal.load !== null && load > goal.load) amounts = amounts.map(n => Math.min(n, goal.min));
    const changes = { load, amounts, confirmed: false, step: undefined };
    if ((weighted && (!weight.trim() || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(weight.trim())))
      || !validWorkoutGoal({ ...goal, ...changes })) {
      setError(`Bitte Gewicht und ${unit} prüfen (1–${goal.max} je Satz).`);
      return;
    }
    onSave(changes);
    onClose();
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2">
      {weighted && <label className="block text-xs text-muted">
        {paired ? 'kg je Hantel / Seite' : goal.mode === 'bodyweight' ? 'Zusatzlast in kg' : 'Arbeitsgewicht in kg'}
        <input className="field mt-1" inputMode="decimal" required value={weight} onChange={e => setWeight(e.target.value)} />
      </label>}
      <label className="block text-xs text-muted">{unit} je Satz (optional)
        <input className="field mt-1" inputMode="numeric" placeholder={goal.amounts.join(' / ')}
          disabled={resetReps} value={resetReps ? goal.min : amount} onChange={e => setAmount(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-ember">{error}</p>}
      <div className="flex gap-2"><button className="action-button" type="submit">Ziel übernehmen</button>
        <button className="secondary-button" type="button" onClick={onClose}>Abbrechen</button></div>
    </form>
  );
}

export default function WorkoutGoal({ exercise, settings, onChange }) {
  const [editing, setEditing] = useState(false);
  const goal = exercise.goal;
  if (!goal) return null;
  const { complete, achieved, total } = getGoalProgress(exercise);
  const nextAction = exercise.skipped ? 'Übersprungen' : complete
    ? (onChange && !goal.confirmed ? 'Ziel erreicht · Reserve bestätigen' : 'Ziel erreicht ✓')
    : onChange ? formatNextGoalSet(exercise) : `${achieved}/${total} Zielsätze erreicht`;
  return (
    <section aria-label="Trainingsziel" className="bg-surface-raised px-3 py-2 text-sm">
      <details>
        <summary className="cursor-pointer font-semibold text-sage">
          <span aria-live="polite">{nextAction}</span>
        </summary>
        <div className="mt-2 space-y-2">
          <p><strong>{formatWorkoutGoal(goal)}</strong> · {achieved}/{total} Zielsätze</p>
          {onChange && <>
            {goal.load === null && <p className="text-xs text-muted">Der erste Arbeitssatz legt dein Startgewicht fest. Aufwärmsätze bitte markieren.</p>}
            {goal.perSide && <p className="text-xs text-muted">{goal.duration
              ? 'Jede Seite einzeln speichern. Links und rechts abwechseln oder L/R im Kommentar angeben.'
              : 'Je Satz beide Seiten trainieren. Die kleinere Wiederholungszahl einmal eintragen.'}</p>}
            {goal.step === 'intro' && <p className="text-xs text-muted">Für diese Variante fehlt eine vergleichbare Arbeitsserie. Der Einstieg nutzt das leichtere Gewicht aus deiner letzten Einheit.</p>}
            {goal.step === 'weight' && <p className="text-xs text-muted">Kleiner Gewichtsschritt. Falls die Stufe fehlt, kannst du das Ziel am Gerät anpassen.</p>}
            {goal.step === 'hold' && <p className="text-xs text-muted">Obergrenze bestätigt. Gewicht halten, bis eine kleine Zwischenstufe verfügbar ist.</p>}
            {complete && <label className="flex items-center gap-2 py-1 font-semibold">
              <input type="checkbox" checked={goal.confirmed} onChange={e => onChange({ confirmed: e.target.checked })} />
              Sauber und mit Reserve geschafft
            </label>}
            {editing ? <GoalEditor goal={goal} settings={settings} onSave={onChange} onClose={() => setEditing(false)} /> :
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-amber-deep underline underline-offset-2">
                {goal.load === null ? 'Arbeitsgewicht wählen' : 'Ziel anpassen'}
              </button>}
            <p className="text-xs text-muted">{goal.scheme || `Bereich ${goal.min}–${goal.max} ${goal.duration ? 'Sekunden' : 'Wdh.'}`}</p>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Wann steigt mein Ziel?</summary>
              <p className="mt-1">Wenn du dein Ziel {goal.confirmations === 1 ? 'einmal' : `an ${goal.confirmations} Trainingstagen`} sauber mit Reserve bestätigst, steigt ein Satz um {goal.duration ? '2 Sekunden' : '1 Wiederholung'}.
                {' '}{goal.duration || goal.mode === 'none' || (goal.mode === 'bodyweight' && settings?.loadType !== 'bodyweight-added') ? 'Am oberen Ende bleibt das Ziel stehen.'
                  : `Bestätigst du alle Sätze bei ${goal.max} an ${goal.weightConfirmations ?? goal.confirmations} Trainingstagen, folgt eine passende Gewichtsstufe. Dann startet jeder Arbeitssatz wieder mit ${goal.min} Wiederholungen.`}</p>
            </details>
          </>}
        </div>
      </details>
    </section>
  );
}
