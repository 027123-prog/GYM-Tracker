import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import ExerciseAutocomplete from '../components/ExerciseAutocomplete';
import ExerciseEditorCard from '../components/ExerciseEditorCard';
import TemplatePicker from '../components/TemplatePicker';
import WorkoutSummaryModal from '../components/WorkoutSummaryModal';
import EmptyState from '../components/EmptyState';
import { calculateWorkoutStats, getLastExerciseWeight } from '../utils/workout';

export default function WorkoutBuilderPage({ mode }) {
  const params = useParams();
  const navigate = useNavigate();
  const {
    state,
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
  } = useAppData();
  const [workoutId, setWorkoutId] = useState(params.workoutId ?? null);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
  }, [mode, navigate, params.workoutId]);

  const workout = state.workouts.find((item) => item.id === workoutId);

  if (mode === 'template' && !workoutId) {
    return (
      <section className="space-y-6">
        <div className="panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine/70">Vorlagen</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Workout aus Vorlage starten</h2>
          <p className="mt-3 text-sm text-ink/70">
            Jede Vorlage wird als neue Session angelegt und bleibt danach komplett editierbar.
          </p>
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
    return <EmptyState title="Workout nicht gefunden" description="Die Session existiert nicht oder wurde entfernt." />;
  }

  const summary = {
    name: workout.name,
    ...calculateWorkoutStats(workout),
  };

  return (
    <>
      <div className="space-y-6">
        <section className="panel p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="workout-name" className="mb-2 block text-sm font-semibold text-ink">
                Workout-Name
              </label>
              <input
                id="workout-name"
                className="field max-w-2xl"
                value={workout.name}
                onChange={(event) => updateWorkoutName(workout.id, event.target.value)}
                placeholder="Mein Workout"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteWorkout(workout.id);
                  navigate('/');
                }}
                className="secondary-button"
              >
                Workout löschen
              </button>
              <button
                type="button"
                onClick={() => {
                  completeWorkout(workout.id);
                  setSummaryOpen(true);
                }}
                className="action-button"
              >
                Workout abschließen
              </button>
            </div>
          </div>
        </section>

        <ExerciseAutocomplete exercises={state.exercises} onAdd={(name) => addExerciseToWorkout(workout.id, name)} />

        <section className="space-y-4">
          {workout.exercises.length ? (
            workout.exercises.map((exercise) => {
              const libraryEntry = state.exercises.find((item) => item.id === exercise.exerciseId);
              const lastWeight = getLastExerciseWeight(
                state.workouts.filter((item) => item.id !== workout.id),
                exercise.exerciseId,
              );

              return (
                <ExerciseEditorCard
                  key={exercise.id}
                  exercise={exercise}
                  libraryEntry={libraryEntry}
                  lastWeight={lastWeight}
                  onRenameExercise={(name) => renameExercise(workout.id, exercise.id, name)}
                  onMoveUp={() => reorderExercise(workout.id, exercise.id, 'up')}
                  onMoveDown={() => reorderExercise(workout.id, exercise.id, 'down')}
                  onToggleSkipped={() => toggleExerciseSkipped(workout.id, exercise.id)}
                  onDeleteExercise={() => deleteExercise(workout.id, exercise.id)}
                  onSaveSet={(payload) => saveSet(workout.id, exercise.id, payload)}
                  onDeleteSet={(setId) => deleteSet(workout.id, exercise.id, setId)}
                />
              );
            })
          ) : (
            <EmptyState
              title="Noch keine Übungen im Workout"
              description="Füge oben eine bestehende Übung hinzu oder lege durch freie Eingabe direkt eine neue an."
            />
          )}
        </section>
      </div>

      <WorkoutSummaryModal
        isOpen={summaryOpen}
        summary={summary}
        onClose={() => setSummaryOpen(false)}
        onGoDashboard={() => navigate('/')}
      />
    </>
  );
}
