import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './components/AppProvider';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import ExerciseChartPage from './pages/ExerciseChartPage';
import WorkoutBuilderPage from './pages/WorkoutBuilderPage';
import WorkoutDetailPage from './pages/WorkoutDetailPage';

export default function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <AppProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/workouts/new" element={<WorkoutBuilderPage mode="free" />} />
            <Route path="/workouts/template" element={<WorkoutBuilderPage mode="template" />} />
            <Route path="/workouts/:workoutId" element={<WorkoutDetailPage />} />
            <Route path="/workouts/:workoutId/edit" element={<WorkoutBuilderPage mode="edit" />} />
            <Route path="/exercises/:exerciseId/chart" element={<ExerciseChartPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </Router>
  );
}
