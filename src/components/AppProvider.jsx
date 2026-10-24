import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadAppState, normalizeAppState, saveAppState, STORAGE_KEY } from '../utils/storage';
import { createId, normalizeWeightOptions } from '../utils/workout';
import { editExerciseRecord, ensureExerciseRecord, findExerciseByName, removeExerciseRecord, restoreExerciseRecord } from '../utils/exerciseEditing';
import { prepareSetValues } from '../utils/setMeasurements';

const AppContext = createContext(null);
const ACTIVE_WORKOUT_KEY = 'gym-tracker-active-workout';
const LEGACY_FREE_DRAFT_KEY = 'gym-tracker-active-free-draft';

function readStoredActiveWorkoutId() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return (
      window.sessionStorage.getItem(ACTIVE_WORKOUT_KEY) ||
      window.sessionStorage.getItem(LEGACY_FREE_DRAFT_KEY)
    );
  } catch {
    return null;
  }
}

function storeActiveWorkoutId(workoutId) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(ACTIVE_WORKOUT_KEY, workoutId);
    window.sessionStorage.removeItem(LEGACY_FREE_DRAFT_KEY);
  } catch {
    // Der Provider-State bleibt auch ohne verfügbaren Session-Speicher funktionsfähig.
  }
}

function clearStoredActiveWorkoutId() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ACTIVE_WORKOUT_KEY);
    window.sessionStorage.removeItem(LEGACY_FREE_DRAFT_KEY);
  } catch {
    // Der Provider-State wird unabhängig vom Session-Speicher bereinigt.
  }
}

function createWorkoutEntry(exercise, options = {}) {
  return {
    id: createId('entry'),
    exerciseId: exercise.id,
    name: exercise.name,
    skipped: false,
    targetRepScheme: options.targetRepScheme ?? '',
    machineSettings: options.machineSettings ?? [],
    sets: [],
  };
}

function getLastMachineSettings(workouts, exerciseId) {
  const sorted = [...workouts]
    .filter((workout) => workout.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  for (const workout of sorted) {
    const match = workout.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId && exercise.machineSettings?.length,
    );

    if (match) {
      return match.machineSettings.map((setting) => ({ ...setting, id: createId('setting') }));
    }
  }

  return [];
}

function updateStartedWorkout(workout, changes) {
  const updatedAt = new Date().toISOString();

  return {
    ...workout,
    ...changes,
    updatedAt,
    ...(!workout.completedAt
      ? {
          draftStartedAt: workout.draftStartedAt || updatedAt,
        }
      : {}),
  };
}

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadAppState());
  const pendingFreeWorkoutIdRef = useRef(null);
  const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
    const storedWorkoutId = readStoredActiveWorkoutId();
    const storedWorkout = state.workouts.find((workout) => workout.id === storedWorkoutId);

    return storedWorkout && !storedWorkout.completedAt ? storedWorkout.id : null;
  });
  const [syncState, setSyncState] = useState({
    status: 'saved',
    message: 'Lokal gespeichert',
    savedAt: null,
  });

  useEffect(() => {
    setSyncState((current) => ({ ...current, status: 'saving', message: 'Wird gespeichert' }));
    const saveTimer = window.setTimeout(() => {
      try {
        saveAppState(state);
        setSyncState({
          status: 'saved',
          message: 'Lokal gespeichert',
          savedAt: new Date().toISOString(),
        });
      } catch {
        setSyncState({
          status: 'error',
          message: 'Speichern fehlgeschlagen',
          savedAt: null,
        });
      }
    }, 120);

    function saveBeforeUnload() {
      try {
        saveAppState(state);
      } catch {
        // Beim Schließen kann kein weiterer Dialog verlässlich angezeigt werden.
      }
    }

    window.addEventListener('beforeunload', saveBeforeUnload);

    return () => {
      window.clearTimeout(saveTimer);
      window.removeEventListener('beforeunload', saveBeforeUnload);
    };
  }, [state]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        setState(normalizeAppState(JSON.parse(event.newValue)));
      } catch {
        setSyncState({
          status: 'error',
          message: 'Änderung aus anderem Tab konnte nicht geladen werden',
          savedAt: null,
        });
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (
      pendingFreeWorkoutIdRef.current &&
      state.workouts.some((workout) => workout.id === pendingFreeWorkoutIdRef.current)
    ) {
      pendingFreeWorkoutIdRef.current = null;
    }

    if (!activeWorkoutId) {
      clearStoredActiveWorkoutId();
      return;
    }

    const activeWorkout = state.workouts.find((workout) => workout.id === activeWorkoutId);

    if (!activeWorkout || activeWorkout.completedAt) {
      clearStoredActiveWorkoutId();
      setActiveWorkoutId(null);
      return;
    }

    storeActiveWorkoutId(activeWorkoutId);
  }, [activeWorkoutId, state.workouts]);

  const activateWorkout = useCallback((workoutId) => {
    storeActiveWorkoutId(workoutId);
    setActiveWorkoutId(workoutId);
  }, []);

  function deactivateWorkout(workoutId = null) {
    if (workoutId && activeWorkoutId !== workoutId) {
      return;
    }

    clearStoredActiveWorkoutId();
    setActiveWorkoutId(null);
  }

  function setWorkouts(nextWorkouts, nextExercises = state.exercises) {
    setState((current) => ({
      ...current,
      exercises: nextExercises,
      workouts: nextWorkouts,
    }));
  }

  function createFreeWorkout() {
    if (pendingFreeWorkoutIdRef.current) {
      return pendingFreeWorkoutIdRef.current;
    }

    const activeFreeWorkout = state.workouts.find(
      (workout) => workout.id === activeWorkoutId && workout.mode === 'free' && !workout.completedAt,
    );

    if (activeFreeWorkout) {
      storeActiveWorkoutId(activeFreeWorkout.id);
      return activeFreeWorkout.id;
    }

    const existingDraft = state.workouts.find(
      (workout) =>
        workout.mode === 'free' &&
        !workout.completedAt &&
        workout.exercises.length === 0 &&
        workout.name === 'Freies Workout',
    );

    if (existingDraft) {
      activateWorkout(existingDraft.id);
      return existingDraft.id;
    }

    const createdAt = new Date().toISOString();
    const workout = {
      id: createId('workout'),
      name: 'Freies Workout',
      date: createdAt,
      updatedAt: createdAt,
      completedAt: null,
      draftStartedAt: null,
      mode: 'free',
      exercises: [],
    };

    pendingFreeWorkoutIdRef.current = workout.id;
    setState((current) => ({
      ...current,
      workouts: [workout, ...current.workouts],
    }));
    activateWorkout(workout.id);

    return workout.id;
  }

  function createWorkoutFromTemplate(templateId) {
    const template = state.templates.find((item) => item.id === templateId);

    if (!template) {
      return null;
    }

    let nextExercises = state.exercises;
    const templateEntries = template.exerciseTemplates.map((exerciseTemplate) => {
      const existingById = nextExercises.find((exercise) => exercise.id === exerciseTemplate.exerciseId);
      const existing = existingById ?? findExerciseByName(nextExercises, exerciseTemplate.name);
      if (existing?.archivedAt) return null;
      const ensured = existingById
        ? { exercises: nextExercises, exercise: existingById }
        : ensureExerciseRecord(nextExercises, exerciseTemplate.name);
      nextExercises = ensured.exercises;
      return createWorkoutEntry(ensured.exercise, {
        targetRepScheme: exerciseTemplate.repScheme,
        machineSettings: getLastMachineSettings(state.workouts, ensured.exercise.id),
      });
    }).filter(Boolean);

    if (!templateEntries.length) return null;

    const createdAt = new Date().toISOString();
    const workout = {
      id: createId('workout'),
      name: template.name,
      date: createdAt,
      updatedAt: createdAt,
      completedAt: null,
      draftStartedAt: null,
      mode: 'template',
      templateId,
      exercises: templateEntries,
    };

    setState((current) => ({
      ...current,
      exercises: nextExercises,
      workouts: [workout, ...current.workouts],
    }));
    activateWorkout(workout.id);

    return workout.id;
  }

  function saveWorkoutAsTemplate(workoutId) {
    const workout = state.workouts.find((item) => item.id === workoutId);

    if (!workout || !workout.exercises.length) {
      return null;
    }

    const templateName = workout.name.trim() || 'Neue Vorlage';
    const exerciseTemplates = workout.exercises
      .filter((entry) => {
        const record = state.exercises.find((exercise) => exercise.id === entry.exerciseId)
          ?? findExerciseByName(state.exercises, entry.name);
        return !record?.archivedAt;
      })
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        repScheme: exercise.targetRepScheme ?? '',
      }));
    if (!exerciseTemplates.length) return null;
    const existingTemplate = state.templates.find(
      (template) => template.name.trim().toLowerCase() === templateName.toLowerCase(),
    );

    setState((current) => ({
      ...current,
      templates: existingTemplate
        ? current.templates.map((template) =>
            template.id === existingTemplate.id
              ? {
                  ...template,
                  name: templateName,
                  exerciseTemplates,
                }
              : template,
          )
        : [
            {
              id: createId('template'),
              name: templateName,
              exerciseTemplates,
            },
            ...current.templates,
          ],
    }));

    return existingTemplate?.id ?? templateName;
  }

  function deleteTemplate(templateId) {
    setState((current) => ({
      ...current,
      templates: current.templates.filter((template) => template.id !== templateId),
    }));
  }

  function duplicateTemplate(templateId) {
    const template = state.templates.find((item) => item.id === templateId);

    if (!template) {
      return null;
    }

    const duplicate = {
      ...template,
      id: createId('template'),
      name: `${template.name} Kopie`,
      exerciseTemplates: template.exerciseTemplates.map((exercise) => ({ ...exercise })),
    };

    setState((current) => ({
      ...current,
      templates: [duplicate, ...current.templates],
    }));

    return duplicate.id;
  }

  function updateWorkoutName(workoutId, name) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? updateStartedWorkout(workout, { name })
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function addExerciseToWorkout(workoutId, exerciseName) {
    return insertExerciseToWorkout(workoutId, exerciseName, 'end');
  }

  function insertExerciseToWorkout(workoutId, exerciseName, placement = 'end', referenceEntryId = null) {
    const trimmedName = exerciseName.trim();

    if (!trimmedName) {
      return null;
    }

    const { exercises: nextExercises, exercise } = ensureExerciseRecord(state.exercises, trimmedName);
    const nextWorkouts = state.workouts.map((workout) => {
      if (workout.id !== workoutId) {
        return workout;
      }

      const nextEntry = createWorkoutEntry(exercise);
      const currentExercises = [...workout.exercises];

      if (placement === 'end' || !referenceEntryId) {
        currentExercises.push(nextEntry);
      } else {
        const referenceIndex = currentExercises.findIndex((item) => item.id === referenceEntryId);
        const insertionIndex =
          referenceIndex < 0 ? currentExercises.length : placement === 'before' ? referenceIndex : referenceIndex + 1;

        currentExercises.splice(insertionIndex, 0, nextEntry);
      }

      return updateStartedWorkout(workout, { exercises: currentExercises });
    });

    setWorkouts(nextWorkouts, nextExercises);
    return exercise.id;
  }

  function renameExercise(workoutId, entryId, nextName) {
    const entry = state.workouts.find((workout) => workout.id === workoutId)
      ?.exercises.find((exercise) => exercise.id === entryId);

    return editLibraryExercise(entry?.exerciseId, { name: nextName });
  }

  function editLibraryExercise(exerciseId, changes) {
    const result = editExerciseRecord(state, exerciseId, changes);

    if (result.error) {
      return result.error;
    }

    setState((current) => editExerciseRecord(current, exerciseId, changes).state);
    return null;
  }

  function updateExerciseSettings(exerciseId, payload = {}) {
    const { name, ...settings } = payload;
    return editLibraryExercise(exerciseId, { name, settings });
  }

  function renameLibraryExercise(exerciseId, name) {
    return editLibraryExercise(exerciseId, { name });
  }

  function removeLibraryExercise(exerciseId) {
    const timestamp = new Date().toISOString();
    const result = removeExerciseRecord(state, exerciseId, timestamp);
    if (!result.error) setState((current) => removeExerciseRecord(current, exerciseId, timestamp).state);
    return { error: result.error, archived: result.archived, deleted: result.deleted };
  }

  function restoreLibraryExercise(exerciseId) {
    const result = restoreExerciseRecord(state, exerciseId);
    if (!result.error) setState((current) => restoreExerciseRecord(current, exerciseId).state);
    return result.error;
  }

  function deleteExercise(workoutId, entryId) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? updateStartedWorkout(workout, {
            exercises: workout.exercises.filter((exercise) => exercise.id !== entryId),
          })
        : workout,
    );

    setWorkouts(nextWorkouts);
  }

  function saveSet(workoutId, entryId, payload) {
    const { values, error } = prepareSetValues(payload);

    if (error) {
      return null;
    }

    let savedSetId = payload.id ?? null;
    let nextExercises = state.exercises;
    const nextWorkouts = state.workouts.map((workout) => {
      if (workout.id !== workoutId) {
        return workout;
      }

      return updateStartedWorkout(workout, {
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
                    weightOptions: normalizeWeightOptions([...(item.weightOptions || []), values.weight]),
                  }
                : item,
            );
          }

          const existingSet = exercise.sets.find((setItem) => setItem.id === payload.id);
          const nextSet = {
            id: payload.id ?? createId('set'),
            ...values,
            comment: payload.comment?.trim() ?? '',
            seatHeight: existingSet?.seatHeight ?? '',
            savedAt: existingSet ? (existingSet.savedAt ?? '') : new Date().toISOString(),
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
      });
    });

    setWorkouts(nextWorkouts, nextExercises);
    return savedSetId;
  }

  function deleteSet(workoutId, entryId, setId) {
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? updateStartedWorkout(workout, {
            exercises: workout.exercises.map((exercise) =>
              exercise.id === entryId
                ? {
                    ...exercise,
                    sets: exercise.sets.filter((setItem) => setItem.id !== setId),
                  }
                : exercise,
            ),
          })
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
            completedAt: workout.completedAt || completedAt,
            updatedAt: completedAt,
          }
        : workout,
    );

    setWorkouts(nextWorkouts);
    if (pendingFreeWorkoutIdRef.current === workoutId) {
      pendingFreeWorkoutIdRef.current = null;
    }
    deactivateWorkout(workoutId);

    return completedAt;
  }

  function deleteWorkout(workoutId) {
    if (pendingFreeWorkoutIdRef.current === workoutId) {
      pendingFreeWorkoutIdRef.current = null;
    }

    deactivateWorkout(workoutId);

    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== workoutId),
    }));
  }

  function importBackup(nextState) {
    const normalizedState = normalizeAppState(nextState);

    pendingFreeWorkoutIdRef.current = null;
    deactivateWorkout();
    setState(normalizedState);
  }

  function addMaxStrengthRecord(payload) {
    const exerciseName = payload.exerciseName?.trim();
    const value = Number(payload.value);

    if (!exerciseName || !payload.date || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    const record = {
      id: createId('max-strength'),
      exerciseName,
      date: payload.date,
      value,
    };

    setState((current) => ({
      ...current,
      maxStrengthRecords: [...(current.maxStrengthRecords || []), record],
    }));

    return record.id;
  }

  function deleteMaxStrengthRecord(recordId) {
    setState((current) => ({
      ...current,
      maxStrengthRecords: current.maxStrengthRecords.filter((record) => record.id !== recordId),
    }));
  }

  return (
    <AppContext.Provider
      value={{
        state,
        syncState,
        activeWorkoutId,
        activateWorkout,
        createFreeWorkout,
        createWorkoutFromTemplate,
        saveWorkoutAsTemplate,
        deleteTemplate,
        duplicateTemplate,
        updateWorkoutName,
        addExerciseToWorkout,
        insertExerciseToWorkout,
        renameExercise,
        renameLibraryExercise,
        removeLibraryExercise,
        restoreLibraryExercise,
        updateExerciseSettings,
        deleteExercise,
        saveSet,
        deleteSet,
        completeWorkout,
        deleteWorkout,
        importBackup,
        addMaxStrengthRecord,
        deleteMaxStrengthRecord,
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
