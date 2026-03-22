import { createContext, useContext, useEffect, useState } from 'react';
import { loadAppState, saveAppState } from '../utils/storage';
import { createId, normalizeWeightOptions } from '../utils/workout';
import { syncToGithub } from '../utils/sync';

const AppContext = createContext(null);
const FREE_DRAFT_KEY = 'gym-tracker-active-free-draft';

function ensureExerciseRecord(exercises, name) {
  const trimmedName = name.trim();
  const existing = exercises.find((exercise) => exercise.name.toLowerCase() === trimmedName.toLowerCase());

  if (existing) {
    return { exercises, exercise: existing };
  }

  const newExercise = {
    id: createId('exercise'),
    name: trimmedName,
    weightOptions: [],
  };

  return {
    exercises: [...exercises, newExercise],
    exercise: newExercise,
  };
}

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadAppState());
  const [syncState, setSyncState] = useState({
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'ready',
    message: 'Lokale Speicherung aktiv',
  });

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    let syncTimer;
    const syncSnapshot = {
      exercises: state.exercises,
      templates: state.templates,
      workouts: state.workouts,
    };

    async function runSync() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncState({ status: 'offline', message: 'Offline gespeichert, Sync folgt später' });
        return;
      }

      setSyncState({ status: 'syncing', message: 'Sync zu GitHub-Platzhalter läuft' });

      try {
        const result = await syncToGithub(syncSnapshot);
        setState((current) => ({
          ...current,
          meta: {
            ...current.meta,
            lastSyncAt: result.lastSyncAt,
          },
        }));
        setSyncState({ status: 'synced', message: result.message });
      } catch {
        setSyncState({ status: 'error', message: 'Sync-Platzhalter konnte nicht ausgeführt werden' });
      }
    }

    syncTimer = window.setTimeout(runSync, 700);

    function handleOnline() {
      runSync();
    }

    function handleOffline() {
      setSyncState({ status: 'offline', message: 'Offline gespeichert, Sync wartet auf Internet' });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.exercises, state.templates, state.workouts]);

  function setWorkouts(nextWorkouts, nextExercises = state.exercises) {
    setState((current) => ({
      ...current,
      exercises: nextExercises,
      workouts: nextWorkouts,
    }));
  }

  function createFreeWorkout() {
    const persistedDraftId =
      typeof window !== 'undefined' ? window.sessionStorage.getItem(FREE_DRAFT_KEY) : null;
    const existingDraft = state.workouts.find(
      (workout) =>
        (!persistedDraftId || workout.id === persistedDraftId) &&
        workout.mode === 'free' &&
        !workout.completedAt &&
        workout.exercises.length === 0 &&
        workout.name === 'Freies Workout',
    );

    if (existingDraft) {
      return existingDraft.id;
    }

    const workout = {
      id: persistedDraftId || createId('workout'),
      name: 'Freies Workout',
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      mode: 'free',
      exercises: [],
    };

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(FREE_DRAFT_KEY, workout.id);
    }

    setState((current) => ({
      ...current,
      workouts: current.workouts.some((entry) => entry.id === workout.id) ? current.workouts : [workout, ...current.workouts],
    }));

    return workout.id;
  }

  function createWorkoutFromTemplate(templateId) {
    const template = state.templates.find((item) => item.id === templateId);

    if (!template) {
      return null;
    }

    let nextExercises = state.exercises;
    const templateEntries = template.exerciseTemplates.map((exerciseTemplate) => {
      const ensured = ensureExerciseRecord(nextExercises, exerciseTemplate.name);
      nextExercises = ensured.exercises;

      return {
        id: createId('entry'),
        exerciseId: ensured.exercise.id,
        name: ensured.exercise.name,
        skipped: false,
        sets: [],
      };
    });

    const workout = {
      id: createId('workout'),
      name: template.name,
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      mode: 'template',
      templateId,
      exercises: templateEntries,
    };

    setState((current) => ({
      ...current,
      exercises: nextExercises,
      workouts: [workout, ...current.workouts],
    }));

    return workout.id;
  }

  function updateWorkoutName(workoutId, name) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            name,
            updatedAt: new Date().toISOString(),
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function addExerciseToWorkout(workoutId, exerciseName) {
    const trimmedName = exerciseName.trim();

    if (!trimmedName) {
      return null;
    }

    const { exercises: nextExercises, exercise } = ensureExerciseRecord(state.exercises, trimmedName);
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            updatedAt: new Date().toISOString(),
            exercises: [
              ...workout.exercises,
              {
                id: createId('entry'),
                exerciseId: exercise.id,
                name: exercise.name,
                skipped: false,
                sets: [],
              },
            ],
          }
        : workout,
    );

    setWorkouts(nextWorkouts, nextExercises);
    return exercise.id;
  }

  function renameExercise(workoutId, entryId, nextName) {
    const trimmedName = nextName.trim();

    if (!trimmedName) {
      return;
    }

    const { exercises: nextExercises, exercise } = ensureExerciseRecord(state.exercises, trimmedName);
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            updatedAt: new Date().toISOString(),
            exercises: workout.exercises.map((exerciseEntry) =>
              exerciseEntry.id === entryId
                ? {
                    ...exerciseEntry,
                    name: exercise.name,
                    exerciseId: exercise.id,
                  }
                : exerciseEntry,
            ),
          }
        : workout,
    );

    setWorkouts(nextWorkouts, nextExercises);
  }

  function reorderExercise(workoutId, entryId, direction) {
    const nextWorkouts = state.workouts.map((workout) => {
      if (workout.id !== workoutId) {
        return workout;
      }

      const index = workout.exercises.findIndex((exercise) => exercise.id === entryId);

      if (index < 0) {
        return workout;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= workout.exercises.length) {
        return workout;
      }

      const nextExercises = [...workout.exercises];
      const [moved] = nextExercises.splice(index, 1);
      nextExercises.splice(targetIndex, 0, moved);

      return {
        ...workout,
        updatedAt: new Date().toISOString(),
        exercises: nextExercises,
      };
    });

    setWorkouts(nextWorkouts);
  }

  function toggleExerciseSkipped(workoutId, entryId) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            updatedAt: new Date().toISOString(),
            exercises: workout.exercises.map((exercise) =>
              exercise.id === entryId ? { ...exercise, skipped: !exercise.skipped } : exercise,
            ),
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function deleteExercise(workoutId, entryId) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            updatedAt: new Date().toISOString(),
            exercises: workout.exercises.filter((exercise) => exercise.id !== entryId),
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function saveSet(workoutId, entryId, payload) {
    let savedSetId = payload.id ?? null;
    let nextExercises = state.exercises;
    const nextWorkouts = state.workouts.map((workout) => {
      if (workout.id !== workoutId) {
        return workout;
      }

      return {
        ...workout,
        updatedAt: new Date().toISOString(),
        exercises: workout.exercises.map((exercise) => {
          if (exercise.id !== entryId) {
            return exercise;
          }

          const existingExercise = nextExercises.find((item) => item.id === exercise.exerciseId);

          if (existingExercise) {
            nextExercises = nextExercises.map((item) =>
              item.id === existingExercise.id
                ? {
                    ...item,
                    weightOptions: normalizeWeightOptions([...(item.weightOptions || []), payload.weight]),
                  }
                : item,
            );
          }

          const nextSet = {
            id: payload.id ?? createId('set'),
            weight: Number(payload.weight),
            reps: Number(payload.reps),
            savedAt: new Date().toISOString(),
          };
          savedSetId = nextSet.id;

          const sets = payload.id
            ? exercise.sets.map((setItem) => (setItem.id === payload.id ? nextSet : setItem))
            : [...exercise.sets, nextSet];

          return {
            ...exercise,
            sets,
          };
        }),
      };
    });

    setWorkouts(nextWorkouts, nextExercises);
    return savedSetId;
  }

  function deleteSet(workoutId, entryId, setId) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            updatedAt: new Date().toISOString(),
            exercises: workout.exercises.map((exercise) =>
              exercise.id === entryId
                ? {
                    ...exercise,
                    sets: exercise.sets.filter((setItem) => setItem.id !== setId),
                  }
                : exercise,
            ),
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function completeWorkout(workoutId) {
    const completedAt = new Date().toISOString();

    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            completedAt,
            updatedAt: completedAt,
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(FREE_DRAFT_KEY) === workoutId) {
      window.sessionStorage.removeItem(FREE_DRAFT_KEY);
    }
    return completedAt;
  }

  function deleteWorkout(workoutId) {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(FREE_DRAFT_KEY) === workoutId) {
      window.sessionStorage.removeItem(FREE_DRAFT_KEY);
    }

    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== workoutId),
    }));
  }

  return (
    <AppContext.Provider
      value={{
        state,
        syncState,
        createFreeWorkout,
        createWorkoutFromTemplate,
        updateWorkoutName,
        addExerciseToWorkout,
        renameExercise,
        reorderExercise,
        toggleExerciseSkipped,
        deleteExercise,
        saveSet,
        deleteSet,
        completeWorkout,
        deleteWorkout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppData muss innerhalb des AppProvider verwendet werden.');
  }

  return context;
}
