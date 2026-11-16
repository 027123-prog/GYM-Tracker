import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { calculateMuscleLoad } from '../../utils/muscleLoad';
import { createAppMuscleMapping } from '../../utils/muscleAssignments';
import './muscleFigure.css';

const MuscleFigure = lazy(() => import('./MuscleFigure'));

export default function MuscleMapCard({ exercises, workouts }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setNow(new Date()); };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const result = useMemo(() => calculateMuscleLoad({ exercises, workouts, mapping: createAppMuscleMapping(exercises, workouts), now }), [exercises, workouts, now]);
  const overview = Object.values(result.muscles).filter(muscle => muscle.id !== 'chest' && muscle.displayIntensity > 0)
    .map(muscle => `${muscle.label}: ${muscle.displayIntensity > 0.5 ? 'kräftiger' : 'schwächer'} eingefärbt`).join('. ');
  return (
    <section className="panel muscle-map-card" aria-label="Muskelkarte deiner Trainingsbelastung">
      <Suspense fallback={<div className="muscle-map-loading" role="status" aria-label="Muskelkarte lädt"><img className="muscle-figure-static" src={`${import.meta.env.BASE_URL}anatomy/fallback-front.png`} alt="" /></div>}>
        <MuscleFigure muscles={result.muscles} controls={false} />
      </Suspense>
      <p className="sr-only">{overview || 'Aktuell keine deutlich hervorgehobene Trainingsbelastung.'}</p>
    </section>
  );
}
