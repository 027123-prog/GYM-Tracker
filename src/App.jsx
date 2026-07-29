import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './components/AppProvider';
import AppShell from './components/AppShell';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExerciseChartPage = lazy(() => import('./pages/ExerciseChartPage'));
const ExerciseLibraryPage = lazy(() => import('./pages/ExerciseLibraryPage'));
const MaxStrengthPage = lazy(() => import('./pages/MaxStrengthPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const WorkoutBuilderPage = lazy(() => import('./pages/WorkoutBuilderPage'));
const WorkoutDetailPage = lazy(() => import('./pages/WorkoutDetailPage'));

function PageLoader() {
  return (
    <div className="panel flex min-h-48 items-center justify-center">
      <span className="eyebrow animate-pulse">HardGainWAF lädt</span>
    </div>
  );
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
      <AppProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/exercises" element={<ExerciseLibraryPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/max-strength" element={<MaxStrengthPage />} />
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
    </Router>
  );
}
