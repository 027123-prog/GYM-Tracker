import { createContext, useContext, useEffect, useState } from 'react';
import { loadAppState, normalizeAppState, saveAppState, STORAGE_KEY } from '../utils/storage';
import { createId, normalizeWeightOptions } from '../utils/workout';

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

function normalizeMachineSettings(settings = []) {
  return settings
    .map((item) => ({
      id: item.id ?? createId('setting'),
      label: item.label?.trim() ?? '',
      value: item.value?.trim() ?? '',
    }))
    .filter((item) => item.label || item.value);
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

    const createdAt = new Date().toISOString();
    const workout = {
      id: persistedDraftId || createId('workout'),
      name: 'Freies Workout',
      date: createdAt,
      updatedAt: createdAt,
      completedAt: null,
      draftStartedAt: null,
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
      const existingById = nextExercises.find((exercise) => exercise.id === exerciseTemplate.exerciseId);
      const ensured = existingById
        ? { exercises: nextExercises, exercise: existingById }
        : ensureExerciseRecord(nextExercises, exerciseTemplate.name);
      nextExercises = ensured.exercises;
      return createWorkoutEntry(ensured.exercise, {
        targetRepScheme: exerciseTemplate.repScheme,
        machineSettings: getLastMachineSettings(state.workouts, ensured.exercise.id),
      });
    });

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

    return workout.id;
  }

  function saveWorkoutAsTemplate(workoutId) {
    const workout = state.workouts.find((item) => item.id === workoutId);

    if (!workout || !workout.exercises.length) {
      return null;
    }

    const templateName = workout.name.trim() || 'Neue Vorlage';
    const exerciseTemplates = workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      repScheme: exercise.targetRepScheme ?? '',
    }));
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
    const trimmedName = nextName.trim();

    if (!trimmedName) {
      return;
    }

    const { exercises: nextExercises, exercise } = ensureExerciseRecord(state.exercises, trimmedName);
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? updateStartedWorkout(workout, {
            exercises: workout.exercises.map((exerciseEntry) =>
              exerciseEntry.id === entryId
                ? {
                    ...exerciseEntry,
                    name: exercise.name,
                    exerciseId: exercise.id,
                  }
                : exerciseEntry,
            ),
          })
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

      const nextEntries = [...workout.exercises];
      const [moved] = nextEntries.splice(index, 1);
      nextEntries.splice(targetIndex, 0, moved);

      return updateStartedWorkout(workout, { exercises: nextEntries });
    });

    setWorkouts(nextWorkouts);
  }

  function saveExerciseMachineSettings(workoutId, entryId, settings) {
    const normalizedSettings = normalizeMachineSettings(settings);
    const nextWorkouts = state.workouts.map((workout) =>
      workout.id === workoutId
        ? updateStartedWorkout(workout, {
            exercises: workout.exercises.map((exercise) =>
              exercise.id === entryId ? { ...exercise, machineSettings: normalizedSettings } : exercise,
            ),
          })
        : workout,
    );

    setWorkouts(nextWorkouts);
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
    const weight = Number(payload.weight);
    const reps = Number(payload.reps);

    if (
      !Number.isFinite(weight) ||
      weight < 0 ||
      weight > 2000 ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 1000
    ) {
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
                    weightOptions: normalizeWeightOptions([...(item.weightOptions || []), weight]),
                  }
                : item,
            );
          }

          const nextSet = {
            id: payload.id ?? createId('set'),
            weight,
            reps,
            comment: payload.comment?.trim() ?? '',
            seatHeight: payload.seatHeight?.trim() ?? '',
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

  function importBackup(nextState) {
    const normalizedState = normalizeAppState(nextState);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(FREE_DRAFT_KEY);
    }

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
        createFreeWorkout,
        createWorkoutFromTemplate,
        saveWorkoutAsTemplate,
        deleteTemplate,
        duplicateTemplate,
        updateWorkoutName,
        addExerciseToWorkout,
        insertExerciseToWorkout,
        renameExercise,
        reorderExercise,
        saveExerciseMachineSettings,
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
