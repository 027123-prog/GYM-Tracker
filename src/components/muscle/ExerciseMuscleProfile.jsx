import { lazy, Suspense, useMemo } from 'react';
import { buildExerciseMuscleProfile } from '../../utils/exerciseMuscleProfile';
import './muscleFigure.css';

const MuscleFigure = lazy(() => import('./MuscleFigure'));
const ExerciseMusclePreview = lazy(() => import('./ExerciseMusclePreview'));

export default function ExerciseMuscleProfile({ exercise, compact = false }) {
  const profile = useMemo(() => buildExerciseMuscleProfile(exercise), [exercise]);
  const summary = profile.rows.map(row => `${row.label}: ${row.strengthLabel.toLocaleLowerCase('de-DE')}`).join('. ');
  const description = profile.status === 'tentative' ? 'Die Übungsvariante ist noch nicht eindeutig zugeordnet.'
    : 'Für diese Übung ist noch keine Muskelzuordnung hinterlegt.';
  const fallback = <div className={compact ? 'exercise-muscle-preview' : 'muscle-figure-stage'} role="status" aria-label="Körperansicht lädt" />;
  if (compact) return <div className="exercise-muscle-compact">
    <Suspense fallback={fallback}>
      <ExerciseMusclePreview muscles={profile.muscles} label={`Muskelgruppen für ${exercise.name}. ${summary || description}`} />
    </Suspense>
    {profile.rows.length ? <p className="sr-only">{summary}</p> : <p className="px-1 pb-2 text-center text-[10px] text-muted">{description}</p>}
  </div>;
  return <section className="panel overflow-hidden" aria-label={`Muskelgruppen für ${exercise.name}`}>
    <div className="px-4 pt-4 sm:px-5 sm:pt-5">
      <h2 className="font-display text-xl font-bold text-ink">Muskelgruppen</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Geschätzte Beteiligung bei dieser Übung · keine gemessenen Aktivierungsprozente</p>
    </div>
    <Suspense fallback={fallback}>
      <MuscleFigure muscles={profile.muscles} ariaLabel={`Muskelgruppen für ${exercise.name}. ${summary || description}`} />
    </Suspense>
    {profile.rows.length ? <ol className="divide-y divide-line border-t border-line px-4 sm:px-5" aria-label="Beteiligung von stark nach schwach">
      {profile.rows.map(row => <li key={row.id} className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{row.label}</p>
            <p className="mt-0.5 text-xs text-muted">{row.roleLabel}</p>
          </div>
          <span className="text-xs font-semibold text-muted">{row.strengthLabel}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${row.weight * 100}%`, backgroundColor: row.color }} />
        </div>
      </li>)}
    </ol> : <p className="px-4 pb-5 text-sm text-muted sm:px-5">{description}</p>}
  </section>;
}
