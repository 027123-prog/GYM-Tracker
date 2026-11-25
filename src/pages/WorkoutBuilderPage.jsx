import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import AddExerciseModal from '../components/AddExerciseModal';
import EmptyState from '../components/EmptyState';
import ExerciseAutocomplete from '../components/ExerciseAutocomplete';
import ExerciseEditorCard from '../components/ExerciseEditorCard';
import MoveExerciseModal from '../components/MoveExerciseModal';
import WorkoutExerciseTabLabel from '../components/WorkoutExerciseTabLabel';
import { getGoalProgress } from '../utils/workoutGoals';
import TemplatePicker from '../components/TemplatePicker';
import WorkoutModeModal from '../components/WorkoutModeModal';
import WorkoutSummaryModal from '../components/WorkoutSummaryModal';
import { getExerciseVolumeProgress, getWorkoutAlternatives } from '../utils/workoutPresentation';
import { readWorkoutExerciseIndex, saveWorkoutExercisePosition } from '../utils/workoutNavigation';
import { getExerciseWeightSuggestions } from '../utils/weightSuggestions';
import {
  calculateWorkoutStats,
  getLastExerciseCommentText,
  getExerciseHistory,
  getLastExerciseSummaryText,
} from '../utils/workout';

export default function WorkoutBuilderPage({ mode }) {
  const params = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const trainingMode = search.get('modus');
  const {
    state,
    activateWorkout,
    createFreeWorkout,
    createWorkoutFromTemplate,
    saveWorkoutAsTemplate,
    updateWorkoutName,
    updateWorkoutGoal,
    addExerciseToWorkout,
    insertExerciseToWorkout,
    moveExerciseInWorkout,
    renameExercise,
    updateExerciseSettings,
    deleteExercise,
    saveSet,
    deleteSet,
    resumeWorkout,
    completeWorkout,
    deleteWorkout,
  } = useAppData();
  const [workoutId, setWorkoutId] = useState(params.workoutId ?? null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [moveExerciseModalOpen, setMoveExerciseModalOpen] = useState(false);
  const [exerciseSelection, setExerciseSelection] = useState(null);
  const exerciseSelectionRef = useRef(null);
  const exerciseTabsRef = useRef(null);
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    if (!templateSaved) {
      return undefined;
    }

    const timer = window.setTimeout(() => setTemplateSaved(false), 1400);
    return () => window.clearTimeout(timer);
  }, [templateSaved]);

  useEffect(() => {
    if (params.workoutId) {
      setWorkoutId(params.workoutId);
      return;
    }

    if (mode === 'free') {
      const createdId = createFreeWorkout();
      setWorkoutId(createdId);
      navigate(`/workouts/${createdId}/edit`, { replace: true });
      return;
    }

    setWorkoutId(null);
  }, [createFreeWorkout, mode, navigate, params.workoutId]);

  const workout = state.workouts.find((item) => item.id === workoutId);
  const activeExerciseIndex = Math.max(
    0,
    Math.min(
      exerciseSelection && exerciseSelection.workoutId === workout?.id
        ? exerciseSelection.index
        : readWorkoutExerciseIndex(workout),
      (workout?.exercises?.length ?? 1) - 1,
    ),
  );
  const activeExercise = workout?.exercises[activeExerciseIndex] ?? null;
  const isCompact = mode === 'edit';

  function setActiveExerciseIndex(nextIndex) {
    const current = exerciseSelectionRef.current;
    const currentIndex = current && current.workoutId === workout?.id
      ? Math.max(0, Math.min(current.index, (workout?.exercises?.length ?? 1) - 1))
      : activeExerciseIndex;
    const requestedIndex = typeof nextIndex === 'function' ? nextIndex(currentIndex) : nextIndex;
    const index = Math.max(0, Math.min(requestedIndex, (workout?.exercises?.length ?? 1) - 1));
    const selection = { workoutId: workout?.id, index };
    exerciseSelectionRef.current = selection;
    saveWorkoutExercisePosition(workout?.id, workout?.exercises[index]?.id);
    setExerciseSelection(selection);
  }

  useEffect(() => {
    if (mode === 'edit' && workout && !workout.completedAt) {
      activateWorkout(workout.id);
    }
  }, [activateWorkout, mode, workout?.completedAt, workout?.id]);

  useLayoutEffect(() => {
    saveWorkoutExercisePosition(workout?.id, activeExercise?.id);

    const tabs = exerciseTabsRef.current;
    const selectedTab = tabs?.querySelector('[aria-current="step"]');
    if (!tabs || !selectedTab) {
      return;
    }

    const tabBounds = selectedTab.getBoundingClientRect();
    const viewportBounds = tabs.getBoundingClientRect();
    if (tabBounds.left < viewportBounds.left) {
      tabs.scrollLeft += tabBounds.left - viewportBounds.left - 8;
    } else if (tabBounds.right > viewportBounds.right) {
      tabs.scrollLeft += tabBounds.right - viewportBounds.right + 8;
    }
  }, [workout?.id, activeExercise?.id, activeExerciseIndex, isCompact]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!workout?.exercises?.length) {
        return;
      }

      const tagName = event.target?.tagName;

      if (
        event.defaultPrevented ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) ||
        event.target?.isContentEditable ||
        event.target?.closest?.('[role="dialog"]')
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveExerciseIndex((current) => Math.min(current + 1, workout.exercises.length - 1));
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveExerciseIndex((current) => Math.max(current - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workout?.id, workout?.exercises?.length, activeExerciseIndex]);

  const previousWorkouts = useMemo(
    () => state.workouts.filter((item) => item.id !== workoutId),
    [state.workouts, workoutId],
  );
  const exerciseHistoryById = useMemo(() => new Map(
    (workout?.exercises ?? []).map((exercise) => [
      exercise.id,
      getExerciseHistory(previousWorkouts, exercise.exerciseId, null, exercise.name),
    ]),
  ), [previousWorkouts, workout?.exercises]);

  if (mode === 'template' && !workoutId) {
    return (
      <section className="space-y-5">
        <div className="border-b border-line pb-5">
          <h1 className="font-display text-3xl font-bold uppercase text-ink">Vorlage wählen</h1>
        </div>
        <TemplatePicker
          templates={state.templates}
          onSelect={(templateId) => {
            if (!['gefuehrt', 'frei'].includes(trainingMode)) return;
            const createdId = createWorkoutFromTemplate(templateId, trainingMode === 'gefuehrt');

            if (createdId) {
              setWorkoutId(createdId);
              navigate(`/workouts/${createdId}/edit`);
            }
          }}
        />
        <WorkoutModeModal isOpen={!['gefuehrt', 'frei'].includes(trainingMode)}
          onChoose={guided => setSearch({ modus: guided ? 'gefuehrt' : 'frei' }, { replace: true })}
          onClose={() => navigate('/workouts/start', { replace: true })} />
      </section>
    );
  }

  if (!workout) {
    return <EmptyState title="Workout nicht gefunden" />;
  }

  const summary = {
    name: workout.name,
    ...calculateWorkoutStats(workout),
  };

  function handleAddExercise(name, placement = 'end') {
    let index = workout.exercises.length;
    let added;
    if (isCompact && activeExercise) {
      added = insertExerciseToWorkout(workout.id, name, placement, activeExercise.id);
      if (placement === 'before') index = activeExerciseIndex;
      if (placement === 'after') index = activeExerciseIndex + 1;
    } else {
      added = addExerciseToWorkout(workout.id, name);
    }
    if (added) {
      const selection = { workoutId: workout.id, index };
      exerciseSelectionRef.current = selection;
      setExerciseSelection(selection);
    }
  }

  function handleMoveExercise(targetIndex) {
    const error = moveExerciseInWorkout(workout.id, activeExercise?.id, targetIndex);
    if (error) return error;

    const selection = { workoutId: workout.id, index: targetIndex };
    exerciseSelectionRef.current = selection;
    saveWorkoutExercisePosition(workout.id, activeExercise.id);
    setExerciseSelection(selection);
    return null;
  }

  function handleDeleteWorkout() {
    if (window.confirm(`Workout "${workout.name}" wirklich löschen?`)) {
      deleteWorkout(workout.id);
      navigate('/');
    }
  }

  return (
    <>
      <div className="workout-editor space-y-3">
        {workout.completedAt ? (
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 flex-1">
                <label htmlFor="workout-name" className="eyebrow mb-2 block">
                  Abgeschlossenes Workout
                </label>
                <input
                  id="workout-name"
                  className="field max-w-2xl font-display text-lg font-bold sm:text-xl"
                  value={workout.name}
                  onChange={(event) => updateWorkoutName(workout.id, event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    saveWorkoutAsTemplate(workout.id);
                    setTemplateSaved(true);
                  }}
                  className={`secondary-button ${templateSaved ? 'border-amber/60 bg-amber-soft' : ''}`}
                >
                  {templateSaved ? 'Gespeichert' : 'Als Vorlage speichern'}
                </button>
                <button type="button" onClick={handleDeleteWorkout} className="danger-button">
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completeWorkout(workout.id);
                    setSummaryOpen(true);
                  }}
                  className="action-button"
                >
                  Fertig
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isCompact ? (
          <section className="panel sticky top-0 z-30 overflow-hidden shadow-panel md:top-[4.5rem]">
            {workout.exercises.length ? (
              <div
                ref={exerciseTabsRef}
                className="flex gap-1.5 overflow-x-auto overscroll-x-contain p-2 [-webkit-overflow-scrolling:touch]"
                aria-label="Übungen im Workout"
              >
                {workout.exercises.map((exercise, index) => {
                  const settings = state.exercises.find((item) => item.id === exercise.exerciseId)?.settings;
                  const tracksVolume = settings?.measurementType !== 'duration' && settings?.loadType !== 'none';
                  const progress = exercise.goal ? getGoalProgress(exercise).percent
                    : tracksVolume ? getExerciseVolumeProgress(exercise, exerciseHistoryById.get(exercise.id)) : null;
                  const comparison = exercise.goal ? 'des Trainingsziels' : 'des Vergleichsvolumens';
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => setActiveExerciseIndex(index)}
                      className={`relative isolate flex h-[3.5625rem] w-40 shrink-0 flex-col justify-center overflow-hidden rounded-sm border px-3 py-1 text-left transition ${
                        index === activeExerciseIndex
                          ? 'border-amber bg-amber-soft text-ink'
                          : 'border-line bg-paper text-muted hover:border-amber/45 hover:text-ink'
                      }`}
                      aria-label={`${exercise.name}, ${exercise.sets.length} Sätze${progress === null ? '' : `, ${progress} Prozent ${comparison}`}`}
                      title={progress === null ? exercise.name : `${exercise.name} · ${progress} % ${comparison}`}
                      aria-current={index === activeExerciseIndex ? 'step' : undefined}
                    >
                      {progress === null ? null : (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-0 -z-10 bg-emerald-500/25 transition-[width] motion-reduce:transition-none"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      )}
                      <WorkoutExerciseTabLabel exercise={exercise} index={index} />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setExerciseModalOpen(true)}
                  className="flex min-w-14 shrink-0 items-center justify-center rounded-sm border border-amber bg-amber-soft px-4 text-2xl font-bold text-amber-deep transition hover:bg-amber/20"
                  aria-label="Übung am Ende der Reiter hinzufügen"
                  title="Übung hinzufügen"
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <ExerciseAutocomplete exercises={state.exercises} onAdd={(name) => handleAddExercise(name, 'end')} />
        )}

        {workout.exercises.length ? (
          activeExercise ? (
            <div>
              <ExerciseEditorCard
                key={activeExercise.id}
                exercise={activeExercise}
                onUpdateGoal={(changes) => updateWorkoutGoal(workout.id, activeExercise.id, changes)}
                compact={isCompact}
                onInsertExercise={() => setExerciseModalOpen(true)}
                onMoveExercise={workout.exercises.length > 1 ? () => setMoveExerciseModalOpen(true) : undefined}
                libraryEntry={state.exercises.find((item) => item.id === activeExercise.exerciseId)}
                weightSuggestions={getExerciseWeightSuggestions(
                  state.exercises.find((item) => item.id === activeExercise.exerciseId)?.weightOptions,
                  state.workouts,
                  activeExercise.exerciseId,
                  state.exercises.find((item) => item.id === activeExercise.exerciseId)?.settings,
                )}
                exerciseHistory={exerciseHistoryById.get(activeExercise.id)}
                lastWorkoutSummary={getLastExerciseSummaryText(
                  previousWorkouts,
                  activeExercise.exerciseId,
                  null,
                  activeExercise.name,
                )}
                lastWorkoutCommentText={getLastExerciseCommentText(
                  previousWorkouts,
                  activeExercise.exerciseId,
                  null,
                  activeExercise.name,
                )}
                onRenameExercise={(name) => renameExercise(workout.id, activeExercise.id, name)}
                onUpdateExerciseSettings={(settings) =>
                  updateExerciseSettings(activeExercise.exerciseId, settings)
                }
                onDeleteExercise={() => {
                  deleteExercise(workout.id, activeExercise.id);
                  setActiveExerciseIndex((current) => Math.max(current - 1, 0));
                }}
                onSaveSet={(payload) => saveSet(workout.id, activeExercise.id, payload)}
                onDeleteSet={(setId, options) => deleteSet(workout.id, activeExercise.id, setId, options)}
              />
            </div>
          ) : null
        ) : (
          <div className="space-y-3">
            <EmptyState
              title="Noch keine Übungen"
            />
            {isCompact ? (
              <button
                type="button"
                onClick={() => setExerciseModalOpen(true)}
                className="action-button mx-auto"
                aria-label="Erste Übung einfügen"
                title="Erste Übung einfügen"
              >
                + Übung
              </button>
            ) : null}
          </div>
        )}

      </div>

      <WorkoutSummaryModal
        isOpen={summaryOpen}
        summary={summary}
        onClose={() => setSummaryOpen(false)}
        onResume={() => {
          resumeWorkout(workout.id);
          setSummaryOpen(false);
        }}
        onGoDashboard={() => navigate('/')}
      />

      <MoveExerciseModal
        isOpen={moveExerciseModalOpen}
        exercise={activeExercise}
        exercises={workout.exercises}
        onClose={() => setMoveExerciseModalOpen(false)}
        onMove={handleMoveExercise}
      />

      <AddExerciseModal
        isOpen={exerciseModalOpen}
        suggestions={exerciseModalOpen ? getWorkoutAlternatives(state.exercises, workout, activeExercise, previousWorkouts) : undefined}
        exercises={state.exercises}
        onClose={() => setExerciseModalOpen(false)}
        onAdd={handleAddExercise}
      />
    </>
  );
}
