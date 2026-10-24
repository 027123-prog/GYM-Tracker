import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppData } from './AppProvider';
import { readWorkoutResumePath, rememberWorkoutView } from '../utils/workoutNavigation';

export default function WorkoutResumeGate({ children }) {
  const location = useLocation();
  const { state } = useAppData();
  const [initialResumePath] = useState(() =>
    location.pathname === '/' ? readWorkoutResumePath(state.workouts) : null,
  );
  const [initialNavigationComplete, setInitialNavigationComplete] = useState(false);
  const isRestoring = !initialNavigationComplete && initialResumePath && location.pathname === '/';

  useEffect(() => {
    if (isRestoring) {
      return;
    }

    rememberWorkoutView(location.pathname, state.workouts);
    setInitialNavigationComplete(true);
  }, [isRestoring, location.pathname, state.workouts]);

  return isRestoring ? <Navigate to={initialResumePath} replace /> : children;
}
