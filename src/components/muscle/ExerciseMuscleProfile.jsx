import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { buildExerciseMuscleProfile, muscleFocusView } from '../../utils/exerciseMuscleProfile';
import './muscleFigure.css';

const MuscleFigure = lazy(() => import('./MuscleFigure'));
const ExerciseMusclePreview = lazy(() => import('./ExerciseMusclePreview'));

export default function ExerciseMuscleProfile({ exercise, compact = false, initialAngle, onAngleCommit }) {
  const profile = useMemo(() => buildExerciseMuscleProfile(exercise), [exercise]);
  const figureRef = useRef(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const showMuscle = row => {
    setFocusRequest(muscleFocusView(row));
    const figure = figureRef.current;
    if (!figure) return;
    const rect = figure.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      figure.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  };
  const summary = profile.rows.map(row => `${row.label}: ${row.strengthLabel.toLocaleLowerCase('de-DE')}`).join('. ');
  const description = profile.status === 'tentative' ? 'Die Übungsvariante ist noch nicht eindeutig zugeordnet.'
    : 'Für diese Übung ist noch keine Muskelzuordnung hinterlegt.';
  const fallback = <div className={compact ? 'exercise-muscle-preview' : 'muscle-figure-stage'} role="status" aria-label="Körperansicht lädt" />;
  if (compact) return <div className="exercise-muscle-compact">
    <Suspense fallback={fallback}>
      <ExerciseMusclePreview muscles={profile.muscles} initialView={profile.defaultView} onAngleCommit={onAngleCommit} label={`Muskelgruppen für ${exercise.name}. ${summary || description}`} />
    </Suspense>
    {profile.rows.length ? <p className="sr-only">{summary}</p> : <p className="px-1 pb-2 text-center text-[10px] text-muted">{description}</p>}
  </div>;
  return <section className="panel overflow-hidden" aria-label={`Muskelgruppen für ${exercise.name}`}>
    <div className="px-4 pt-4 sm:px-5 sm:pt-5">
      <h2 className="font-display text-xl font-bold text-ink">Muskelgruppen</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Geschätzte Beteiligung bei dieser Übung.{profile.rows.length > 0 && ' Tippe auf einen Muskel, um ihn am Körper zu sehen.'}</p>
    </div>
    <div ref={figureRef}>
      <Suspense fallback={fallback}>
        <MuscleFigure muscles={profile.muscles} initialView={profile.defaultView} initialAngle={initialAngle} focusRequest={focusRequest}
          ariaLabel={`Muskelgruppen für ${exercise.name}. ${summary || description}`} />
      </Suspense>
    </div>
    {profile.rows.length ? <ol className="divide-y divide-line border-t border-line px-4 sm:px-5" aria-label="Beteiligung von stark nach schwach">
      {profile.rows.map(row => <li key={row.id}>
        <button type="button" className="muscle-focus-row w-full py-3 text-left" onClick={() => showMuscle(row)}
          aria-label={`${row.label} am Körper zeigen, ${row.roleLabel}, ${row.strengthLabel}`}>
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{row.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{row.roleLabel}</span>
          </span>
          <span className="text-xs font-semibold text-muted">{row.strengthLabel}</span>
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
          <span className="block h-full rounded-full" style={{ width: `${row.weight * 100}%`, backgroundColor: row.color }} />
        </span>
        </button>
      </li>)}
    </ol> : <p className="px-4 pb-5 text-sm text-muted sm:px-5">{description}</p>}
  </section>;
}
