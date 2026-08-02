import { Component, lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AppProvider } from './components/AppProvider';
import AppShell from './components/AppShell';

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

function InitialDashboardGate({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isReady) {
      return;
    }

    if (location.pathname !== '/') {
      navigate('/', { replace: true });
      return;
    }

    setIsReady(true);
  }, [isReady, location.pathname, navigate]);

  return isReady ? children : <PageLoader />;
}

function findScrollableParent(element) {
  let current = element;

  while (current && current !== document.body) {
    if (!(current instanceof HTMLElement)) {
      current = current.parentElement;
      continue;
    }

    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;

    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export default function App() {
  const useHashRouting =
    window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  const Router = useHashRouting ? HashRouter : BrowserRouter;

  useEffect(() => {
    let touchStartY = 0;
    let touchTarget = null;

    function handleTouchStart(event) {
      if (event.touches.length !== 1) {
        return;
      }

      touchStartY = event.touches[0].clientY;
      touchTarget = event.target;
    }

    function handleTouchMove(event) {
      if (event.touches.length !== 1) {
        return;
      }

      const currentY = event.touches[0].clientY;
      const isPullingDown = currentY > touchStartY;

      if (!isPullingDown) {
        return;
      }

      const scrollableParent = findScrollableParent(touchTarget);
      const isAtTop = scrollableParent ? scrollableParent.scrollTop <= 0 : window.scrollY <= 0;

      if (isAtTop) {
        event.preventDefault();
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <Router>
      <AppErrorBoundary>
        <InitialDashboardGate>
          <AppProvider>
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
          </AppProvider>
        </InitialDashboardGate>
      </AppErrorBoundary>
    </Router>
  );
}
