import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppData } from './AppProvider';
import { readWorkoutResumePath, rememberWorkoutView } from '../utils/workoutNavigation';

export default function WorkoutResumeGate({ children }) {
  const location = useLocation();
  const { state } = useAppData();
  const [resumePath, setResumePath] = useState(() =>
    location.pathname === '/' ? readWorkoutResumePath(state.workouts) : null,
  );
  const backgroundResumePath = useRef(null);
  const currentView = useRef({ pathname: location.pathname, workouts: state.workouts });
  const isRestoring = resumePath && location.pathname === '/';

  useLayoutEffect(() => {
    currentView.current = { pathname: location.pathname, workouts: state.workouts };
    if (isRestoring) return;
    // Some installed browsers reopen the start URL in a still-hidden document.
    // Restore only a view captured before backgrounding, never ordinary Back/Home navigation.
    if (location.pathname === '/' && document.visibilityState === 'hidden'
      && backgroundResumePath.current === readWorkoutResumePath(state.workouts)) {
      if (backgroundResumePath.current) {
        setResumePath(backgroundResumePath.current);
        return;
      }
    }
    rememberWorkoutView(location.pathname, state.workouts);
    backgroundResumePath.current = null;
    if (resumePath) setResumePath(null);
  }, [isRestoring, location.pathname, state.workouts]);

  useEffect(() => {
    function captureBackgroundView() {
      const view = currentView.current;
      if (/^\/workouts\/[^/]+\/edit$/.test(view.pathname)) {
        rememberWorkoutView(view.pathname, view.workouts);
        backgroundResumePath.current = readWorkoutResumePath(view.workouts);
      }
    }
    function handleVisibility() {
      if (document.visibilityState === 'hidden') captureBackgroundView();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', captureBackgroundView);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', captureBackgroundView);
    };
  }, []);

  return isRestoring ? <Navigate to={resumePath} replace /> : children;
}
