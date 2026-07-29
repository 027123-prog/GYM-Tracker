import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import BackupControls from './BackupControls';
import SyncIndicator from './SyncIndicator';

const appVersion = '2.0.0';

const navItems = [
  { to: '/', label: 'Übersicht', shortLabel: 'Übersicht', marker: '01' },
  { to: '/workouts/new', label: 'Training', shortLabel: 'Training', marker: '+' },
  { to: '/exercises', label: 'Übungen', shortLabel: 'Übungen', marker: '02' },
  { to: '/max-strength', label: 'Fortschritt', shortLabel: 'Fortschritt', marker: '03' },
];

function isNavActive(pathname, to) {
  if (to === '/') {
    return pathname === '/';
  }

  if (to === '/workouts/new') {
    return pathname.startsWith('/workouts');
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

function AppNavigation({ mobile = false }) {
  const location = useLocation();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={
        mobile
          ? 'grid grid-cols-4 border-t border-line bg-surface/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur'
          : 'flex items-center gap-1'
      }
    >
      {navItems.map((item) => {
        const active = isNavActive(location.pathname, item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={
              mobile
                ? `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-[10px] font-semibold transition ${
                    active ? 'bg-amber-soft text-amber-deep' : 'text-muted hover:text-ink'
                  }`
                : `flex min-h-10 items-center gap-2 rounded-sm border px-3 text-sm font-semibold transition ${
                    active
                      ? 'border-amber/60 bg-amber-soft text-amber-deep'
                      : 'border-transparent text-muted hover:border-line hover:bg-surface-raised hover:text-ink'
                  }`
            }
          >
            <span
              aria-hidden="true"
              className={`font-display text-xs font-bold ${active ? 'text-amber' : 'text-muted'}`}
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

export default function AppShell() {
  const location = useLocation();
  const isWorkoutFocus = /^\/workouts\/.+\/edit$/.test(location.pathname);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-3 py-2.5 sm:px-5">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Zur Übersicht">
            <span className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
              <span className="absolute inset-[2px] rounded-full border-2 border-amber" />
              <span className="absolute right-0 top-0 h-4 w-2 rotate-[38deg] bg-paper" />
              <span className="absolute right-[1px] top-[2px] h-[2px] w-2 rotate-[38deg] bg-amber" />
              <span className="-skew-x-12 font-display text-base font-black tracking-[-0.12em] text-amber">
                HG
              </span>
            </span>
          </Link>

          <div className="hidden flex-1 md:block">
            <AppNavigation />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isWorkoutFocus ? (
              <span className="hidden rounded-sm border border-amber/35 bg-amber-soft px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-deep sm:block">
                Training aktiv
              </span>
            ) : null}
            <SyncIndicator compact />
            <div className="hidden lg:block">
              <BackupControls compact />
            </div>
            <span className="hidden text-[10px] font-bold tracking-[0.14em] text-muted xl:block">
              V{appVersion}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 pb-24 pt-4 sm:px-5 sm:pt-6 md:pb-8">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <AppNavigation mobile />
      </div>
    </div>
  );
}
