import { Link, Outlet, useLocation } from 'react-router-dom';
import SyncIndicator from './SyncIndicator';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/workouts/new', label: 'Neues Workout' },
  { to: '/workouts/template', label: 'Vorlage' },
];

export default function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="panel overflow-hidden">
          <div className="flex flex-col gap-5 bg-[linear-gradient(135deg,rgba(242,170,107,0.18),rgba(143,183,164,0.1))] p-6 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-pine/75">Personal Gym Log</p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  Trainieren, speichern, später auswerten.
                </h1>
                <p className="mt-3 max-w-xl text-sm text-ink/70 sm:text-base">
                  Lokales Workout-Tracking mit editierbaren Vorlagen, Satz-für-Satz Speicherung und Verlaufsdiagrammen.
                </p>
              </div>
              <SyncIndicator />
            </div>
            <nav className="flex flex-wrap gap-3">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={isActive ? 'action-button' : 'secondary-button'}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
