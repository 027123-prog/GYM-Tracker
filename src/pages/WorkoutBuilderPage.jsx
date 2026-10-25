import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import AddExerciseModal from '../components/AddExerciseModal';
import EmptyState from '../components/EmptyState';
import ExerciseAutocomplete from '../components/ExerciseAutocomplete';
import ExerciseEditorCard from '../components/ExerciseEditorCard';
import TemplatePicker from '../components/TemplatePicker';
import WorkoutSummaryModal from '../components/WorkoutSummaryModal';
import { readWorkoutExerciseIndex, saveWorkoutExercisePosition } from '../utils/workoutNavigation';
import { getExerciseWeightSuggestions } from '../utils/weightSuggestions';
import {
  calculateWorkoutStats,
  getLastExerciseCommentText,
  getLastExerciseSummaryText,
} from '../utils/workout';

export default function WorkoutBuilderPage({ mode }) {
  const params = useParams();
  const navigate = useNavigate();
  const {
    state,
    activateWorkout,
    createFreeWorkout,
    createWorkoutFromTemplate,
    saveWorkoutAsTemplate,
    updateWorkoutName,
    addExerciseToWorkout,
    insertExerciseToWorkout,
    renameExercise,
    updateExerciseSettings,
    deleteExercise,
    saveSet,
    deleteSet,
    completeWorkout,
    deleteWorkout,
  } = useAppData();
  const [workoutId, setWorkoutId] = useState(params.workoutId ?? null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseSelection, setExerciseSelection] = useState(null);
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
    setExerciseSelection((current) => {
      const currentIndex = current && current.workoutId === workout?.id
        ? Math.max(0, Math.min(current.index, (workout?.exercises?.length ?? 1) - 1))
        : activeExerciseIndex;
      return {
        workoutId: workout?.id,
        index: typeof nextIndex === 'function' ? nextIndex(currentIndex) : nextIndex,
      };
    });
  }

  useEffect(() => {
    if (mode === 'edit' && workout && !workout.completedAt) {
      activateWorkout(workout.id);
    }
  }, [activateWorkout, mode, workout?.completedAt, workout?.id]);

  useEffect(() => {
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
  }, [workout?.id, activeExercise?.id, isCompact]);

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

  if (mode === 'template' && !workoutId) {
    return (
      <section className="space-y-5">
        <div className="border-b border-line pb-5">
          <h1 className="font-display text-3xl font-bold uppercase text-ink">Vorlage wählen</h1>
        </div>
        <TemplatePicker
          templates={state.templates}
          onSelect={(templateId) => {
            const createdId = createWorkoutFromTemplate(templateId);

            if (createdId) {
              setWorkoutId(createdId);
              navigate(`/workouts/${createdId}/edit`);
            }
          }}
        />
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
    if (isCompact && activeExercise) {
      insertExerciseToWorkout(workout.id, name, placement, activeExercise.id);

      if (placement === 'before') {
        return;
      }

      if (placement === 'after') {
        setActiveExerciseIndex((current) => Math.min(current + 1, workout.exercises.length));
        return;
      }
    } else {
      addExerciseToWorkout(workout.id, name);
    }

    setActiveExerciseIndex(workout.exercises.length);
  }

  function handleDeleteWorkout() {
    if (window.confirm(`Workout "${workout.name}" wirklich löschen?`)) {
      deleteWorkout(workout.id);
      navigate('/');
    }
  }

  return (
    <>
      <div className="space-y-3">
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
                  const nameParts = exercise.name.match(/^(.+?)(?:\s+-\s+|\s*[–—]\s*)(.+)$/);
                  const mainName = nameParts ? nameParts[1].trim() : exercise.name;
                  const nameDetail = nameParts ? nameParts[2].trim() : '';

                  return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => setActiveExerciseIndex(index)}
                    className={`flex h-[3.5625rem] w-40 shrink-0 flex-col justify-center rounded-sm border px-3 py-1 text-left transition ${
                      index === activeExerciseIndex
                        ? 'border-amber bg-amber-soft text-ink'
                        : 'border-line bg-paper text-muted hover:border-amber/45 hover:text-ink'
                    }`}
                    aria-label={`${exercise.name}, ${exercise.sets.length} Sätze`}
                    title={exercise.name}
                    aria-current={index === activeExerciseIndex ? 'step' : undefined}
                  >
                    <span className="block text-[10px] font-bold uppercase leading-3 tracking-[0.14em] text-amber-deep">
                      {String(index + 1).padStart(2, '0')} · {exercise.sets.length} Sätze
                    </span>
                    <span className="mt-1 flex h-7 w-full flex-col justify-center">
                      <span className="block w-full truncate text-sm font-bold leading-4">{mainName}</span>
                      {nameDetail ? (
                        <span className="block w-full truncate text-[10px] leading-3 text-muted">{nameDetail}</span>
                      ) : null}
                    </span>
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
                compact={isCompact}
                canMovePrevExercise={activeExerciseIndex > 0}
                canMoveNextExercise={activeExerciseIndex < workout.exercises.length - 1}
                onPrevExercise={() => setActiveExerciseIndex((current) => Math.max(current - 1, 0))}
                onNextExercise={() =>
                  setActiveExerciseIndex((current) => Math.min(current + 1, workout.exercises.length - 1))
                }
                onInsertExercise={() => setExerciseModalOpen(true)}
                libraryEntry={state.exercises.find((item) => item.id === activeExercise.exerciseId)}
                weightSuggestions={getExerciseWeightSuggestions(
                  state.exercises.find((item) => item.id === activeExercise.exerciseId)?.weightOptions,
                  state.workouts,
                  activeExercise.exerciseId,
                )}
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
                onDeleteSet={(setId) => deleteSet(workout.id, activeExercise.id, setId)}
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
        onGoDashboard={() => navigate('/')}
      />

      <AddExerciseModal
        isOpen={exerciseModalOpen}
        exercises={state.exercises}
        onClose={() => setExerciseModalOpen(false)}
        onAdd={handleAddExercise}
      />
    </>
  );
}
