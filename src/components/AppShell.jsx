import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BackupControls from './BackupControls';
import { useAppData } from './AppProvider';
import SyncIndicator from './SyncIndicator';
import { calculateWorkoutStats } from '../utils/workout';

const appVersion = '2.5.0';
const displayVersion = `v${appVersion.split('.').slice(0, 2).join('.')}`;

const navItems = [
  { to: '/', label: 'Übersicht', shortLabel: 'Übersicht', marker: '01' },
  { to: '/workouts/start', label: 'Training', shortLabel: 'Training', marker: '+' },
  { to: '/exercises', label: 'Übungen', shortLabel: 'Übungen', marker: '02' },
  { to: '/max-strength', label: 'Fortschritt', shortLabel: 'Fortschritt', marker: '03' },
];

function isNavActive(pathname, to) {
  if (to === '/') {
    return pathname === '/';
  }

  if (to === '/workouts/start') {
    return pathname.startsWith('/workouts');
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

function AppNavigation({ mobile = false, trainingTarget, hasActiveWorkout = false }) {
  const location = useLocation();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={
        mobile
          ? 'grid h-full grid-cols-4 border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] pt-1'
          : 'flex items-center gap-1'
      }
    >
      {navItems.map((item) => {
        const active = isNavActive(location.pathname, item.to);
        const isTraining = item.to === '/workouts/start';
        const target = isTraining ? trainingTarget : item.to;
        const workoutRunning = isTraining && hasActiveWorkout;

        return (
          <NavLink
            key={item.to}
            to={target}
            className={
              mobile
                ? `flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-[10px] font-semibold transition ${
                    active
                      ? 'bg-amber text-paper shadow-[0_0_0_1px_rgba(244,122,36,0.35)]'
                      : workoutRunning
                        ? 'bg-amber-soft text-amber-deep ring-1 ring-inset ring-amber/55'
                        : 'text-muted hover:text-ink'
                  }`
                : `flex min-h-10 items-center gap-2 rounded-sm border px-3 text-sm font-semibold transition ${
                    active || workoutRunning
                      ? 'border-amber/60 bg-amber-soft text-amber-deep'
                      : 'border-transparent text-muted hover:border-line hover:bg-surface-raised hover:text-ink'
                  }`
            }
          >
            <span
              aria-hidden="true"
              className={`font-display text-xs font-bold ${
                active ? (mobile ? 'text-paper' : 'text-amber') : workoutRunning ? 'text-amber' : 'text-muted'
              }`}
            >
              {item.marker}
            </span>
            <span>{mobile ? item.shortLabel : item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function ActiveWorkoutControl({ workout, trainingTarget }) {
  const navigate = useNavigate();
  const { updateWorkoutName, saveWorkoutAsTemplate, completeWorkout, deleteWorkout } = useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const controlRef = useRef(null);
  const stats = calculateWorkoutStats(workout);
  const canComplete = stats.setCount > 0;
  const usesDefaultName = workout.mode === 'free' && workout.name.trim() === 'Freies Workout';
  const menuId = `active-workout-menu-${workout.id}`;

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function closeOutside(event) {
      if (!controlRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!templateSaved) {
      return undefined;
    }

    const timer = window.setTimeout(() => setTemplateSaved(false), 1400);
    return () => window.clearTimeout(timer);
  }, [templateSaved]);

  return (
    <div ref={controlRef} className="relative min-w-0 flex-1 md:max-w-[280px] md:flex-none">
      <div className="flex min-w-0 items-stretch rounded-sm border border-amber/55 bg-amber-soft">
        <Link
          to={trainingTarget}
          className="min-w-0 flex-1 px-2.5 py-1.5 transition hover:bg-amber/10"
          aria-label={`Aktives Workout öffnen: ${workout.name}`}
        >
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-amber-deep">
            Aktives Workout
          </span>
          <span className="block truncate text-xs font-bold text-ink sm:text-sm">{workout.name}</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`flex w-11 shrink-0 items-center justify-center border-l border-amber/40 text-lg text-amber-deep transition hover:bg-amber/15 ${
            menuOpen ? 'bg-amber/15' : ''
          }`}
          aria-label="Aktives Workout verwalten"
          title="Aktives Workout verwalten"
          aria-expanded={menuOpen}
          aria-controls={menuId}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>

      {menuOpen ? (
        <section
          id={menuId}
          className="panel absolute right-0 top-full z-[70] mt-2 w-[min(calc(100vw-1.5rem),22rem)] p-3 shadow-panel sm:p-4"
        >
          <label htmlFor="active-workout-name" className="eyebrow mb-2 block">
            Workout-Name
          </label>
          <input
            id="active-workout-name"
            className="field font-display text-base font-bold"
            value={usesDefaultName ? '' : workout.name}
            onChange={(event) => updateWorkoutName(workout.id, event.target.value)}
            onBlur={() => {
              if (!workout.name.trim()) {
                updateWorkoutName(workout.id, 'Freies Workout');
              }
            }}
            placeholder="Freies Workout"
            autoComplete="off"
          />
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              disabled={!canComplete}
              title={canComplete ? '' : 'Speichere mindestens einen Satz, bevor du das Workout abschließt.'}
              onClick={() => {
                completeWorkout(workout.id);
                navigate(`/workouts/${workout.id}`);
              }}
              className="action-button w-full"
            >
              Workout abschließen
            </button>
            <button
              type="button"
              onClick={() => {
                saveWorkoutAsTemplate(workout.id);
                setTemplateSaved(true);
              }}
              className={`secondary-button w-full ${templateSaved ? 'border-amber/60 bg-amber-soft' : ''}`}
            >
              {templateSaved ? 'Als Vorlage gespeichert' : 'Als Vorlage speichern'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Workout "${workout.name}" wirklich löschen?`)) {
                  deleteWorkout(workout.id);
                  navigate('/');
                }
              }}
              className="danger-button w-full"
            >
              Workout löschen
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const { state, activeWorkoutId } = useAppData();
  const mainRef = useRef(null);
  const activeWorkout = state.workouts.find(
    (workout) => workout.id === activeWorkoutId && !workout.completedAt,
  );
  const trainingTarget = activeWorkout
    ? `/workouts/${encodeURIComponent(activeWorkout.id)}/edit`
    : '/workouts/start';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div
      data-app-shell
      className="flex h-[100dvh] min-h-0 flex-col overflow-hidden md:h-auto md:min-h-[100dvh] md:overflow-visible"
    >
      <header
        className={`relative z-40 shrink-0 border-b backdrop-blur-xl md:sticky md:top-0 ${
          activeWorkout
            ? 'border-amber/55 bg-[linear-gradient(90deg,rgba(244,122,36,0.13),rgba(25,25,25,0.94)_62%)]'
            : 'border-line bg-paper/90'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-3 py-2.5 sm:px-5">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Zur Übersicht">
            <span className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
              <span className="absolute inset-[2px] rounded-full border-2 border-amber" />
              <span className="-skew-x-12 font-display text-base font-black tracking-[-0.12em] text-amber">
                HG
              </span>
              <span className="absolute -bottom-1 -right-1 px-0.5 font-display text-[7px] font-bold leading-3 tracking-tight text-muted">
                {displayVersion}
              </span>
            </span>
          </Link>

          <div className="hidden flex-1 md:block">
            <AppNavigation trainingTarget={trainingTarget} hasActiveWorkout={Boolean(activeWorkout)} />
          </div>

          {activeWorkout ? (
            <ActiveWorkoutControl workout={activeWorkout} trainingTarget={trainingTarget} />
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <SyncIndicator compact />
            <div className="hidden lg:block">
              <BackupControls compact />
            </div>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        data-app-scroll-container
        className="mx-auto min-h-0 w-full max-w-7xl flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-4 pt-4 [-webkit-overflow-scrolling:touch] sm:px-5 sm:pt-6 md:overflow-visible md:overscroll-auto md:pb-8"
      >
        <Outlet />
      </main>

      <div
        data-mobile-navigation
        className="relative z-50 h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 bg-surface md:hidden"
      >
        <AppNavigation mobile trainingTarget={trainingTarget} hasActiveWorkout={Boolean(activeWorkout)} />
      </div>
    </div>
  );
}
