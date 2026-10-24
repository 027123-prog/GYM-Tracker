import { Component, lazy, Suspense } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { AppProvider } from './components/AppProvider';
import AppShell from './components/AppShell';
import WorkoutResumeGate from './components/WorkoutResumeGate';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExerciseChartPage = lazy(() => import('./pages/ExerciseChartPage'));
const ExerciseLibraryPage = lazy(() => import('./pages/ExerciseLibraryPage'));
const MaxStrengthPage = lazy(() => import('./pages/MaxStrengthPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const WorkoutBuilderPage = lazy(() => import('./pages/WorkoutBuilderPage'));
const WorkoutDetailPage = lazy(() => import('./pages/WorkoutDetailPage'));
const WorkoutStartPage = lazy(() => import('./pages/WorkoutStartPage'));

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-4 py-10">
        <section className="panel w-full p-5 text-center sm:p-6">
          <p className="eyebrow">HardGainWAF aktualisiert</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">Ansicht neu laden</h1>
          <p className="mt-2 text-sm text-muted">
            Deine Trainingsdaten sind sicher. Lade nur die App neu, um die aktuelle Version zu öffnen.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="action-button mt-5 w-full">
            App neu laden
          </button>
        </section>
      </div>
    );
  }
}

function PageLoader() {
  return (
    <div className="panel flex min-h-48 items-center justify-center">
      <span className="eyebrow animate-pulse">Lädt</span>
    </div>
  );
}

export default function App() {
  const useHashRouting =
    window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  const Router = useHashRouting ? HashRouter : BrowserRouter;

  return (
    <Router>
      <AppErrorBoundary>
        <AppProvider>
          <WorkoutResumeGate>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/exercises" element={<ExerciseLibraryPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/max-strength" element={<MaxStrengthPage />} />
                  <Route path="/workouts/start" element={<WorkoutStartPage />} />
                  <Route path="/workouts/new" element={<WorkoutBuilderPage mode="free" />} />
                  <Route path="/workouts/template" element={<WorkoutBuilderPage mode="template" />} />
                  <Route path="/workouts/:workoutId" element={<WorkoutDetailPage />} />
                  <Route path="/workouts/:workoutId/edit" element={<WorkoutBuilderPage mode="edit" />} />
                  <Route path="/exercises/:exerciseId/chart" element={<ExerciseChartPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </WorkoutResumeGate>
        </AppProvider>
      </AppErrorBoundary>
    </Router>
  );
}
