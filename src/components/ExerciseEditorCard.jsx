import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ExerciseSettingsModal from './ExerciseSettingsModal';
import WorkoutGoal from './WorkoutGoal';
import { nextGoalQuantity } from '../utils/workoutGoals';
import SetEntryModal from './SetEntryModal';
import StopwatchModal from './StopwatchModal';
import ExerciseHistoryModal from './ExerciseHistoryModal';
import InterfaceIcon from './InterfaceIcon';
import { formatSetTime } from '../utils/date';
import { formatSetSummary } from '../utils/setMeasurements';
import { getRepeatedSetPayload } from '../utils/setEntry';
import { getExerciseWeightSuggestions } from '../utils/weightSuggestions';
import { getTimerLoad } from '../utils/timerLoad';

const compactIconButtonClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-raised text-ink transition hover:border-amber/70 hover:text-amber-deep';

function ChartIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path d="M4 19V5M4 19H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="m7 15 3.2-3.4 3 2.1L19 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function renderSetSummary(setItem) {
  const [prefix, multiplier, load] = formatSetSummary(setItem).split(/(\d+x)(?=\d)/);
  return multiplier ? <>{prefix}<span className="mr-0.5 text-sm font-semibold text-muted">{multiplier}</span>{load}</> : prefix;
}

export default function ExerciseEditorCard({
  exercise,
  compact = false,
  libraryEntry,
  weightSuggestions,
  lastWorkoutSummary,
  lastWorkoutCommentText,
  exerciseHistory = [],
  onInsertExercise,
  onMoveExercise,
  onRenameExercise,
  onUpdateExerciseSettings,
  onDeleteExercise,
  onSaveSet,
  onDeleteSet,
  onUpdateGoal,
}) {
  const location = useLocation();
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerSetup, setTimerSetup] = useState(false);
  const [timerLoad, setTimerLoad] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState('');
  const [draftName, setDraftName] = useState(exercise.name);
  const [renameError, setRenameError] = useState('');
  const bottomAnchorRef = useRef(null);
  const durationExercise = libraryEntry?.settings?.measurementType === 'duration';

  const legacyMachineSettingsText = useMemo(
    () => (exercise.machineSettings ?? [])
        .map((item) => ({
          label: item.label?.trim() ?? '',
          value: item.value?.trim() ?? '',
        }))
        .filter((item) => item.label || item.value)
        .map((item) => (item.label && item.value ? `${item.label}: ${item.value}` : item.label || item.value))
        .join(' · '),
    [exercise.machineSettings],
  );
  const setupNotes = libraryEntry?.settings?.setupNotes ?? '';
  const machineSettingsText = [
    setupNotes,
    legacyMachineSettingsText && !setupNotes.includes(legacyMachineSettingsText) ? legacyMachineSettingsText : '',
  ].filter(Boolean).join(' · ');

  useEffect(() => {
    setDraftName(exercise.name);
    setRenameError('');
  }, [exercise.name]);

  function openNewSet() {
    setEditingSet(null);
    setTimerSetup(false);
    if (durationExercise) {
      const goal = exercise.goal;
      let source = exercise.sets.at(-1);
      if (goal?.load != null && ['paired', 'normal'].includes(goal.mode)) source = { weight: goal.load, weightMode: goal.mode };
      if (goal?.mode === 'bodyweight' && source) source = { ...source, addedWeight: goal.load };
      const load = getTimerLoad(libraryEntry?.settings, source);
      setTimerLoad(load);
      if (load) {
        setTimerOpen(true);
      } else {
        setTimerSetup(true);
        setSetModalOpen(true);
      }
      return;
    }
    setSetModalOpen(true);
  }

  function editSet(setItem) {
    setTimerSetup(false);
    setEditingSet(setItem);
    setSetModalOpen(true);
  }

  function saveSet(payload) {
    const savedSetId = onSaveSet(payload);
    if (!savedSetId) return null;
    setRecentlySaved(savedSetId ?? payload.id ?? 'new');
    window.setTimeout(() => setRecentlySaved(''), 900);

    if (!payload.id) {
      window.requestAnimationFrame(() => bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
    return savedSetId;
  }

  function configureTimerLoad() {
    setTimerOpen(false);
    setEditingSet(timerLoad);
    setTimerSetup(true);
    setSetModalOpen(true);
  }

  function saveModalValues(payload) {
    if (!timerSetup) return saveSet(payload);
    const { id, comment, ...load } = payload;
    setTimerLoad(load);
    setTimerOpen(true);
    return true;
  }

  function repeatLastSet() {
    const latest = exercise.sets[exercise.sets.length - 1];
    if (!latest) return;
    const payload = getRepeatedSetPayload(latest, libraryEntry?.settings);
    if (!payload) {
      openNewSet();
      return;
    }
    saveSet(payload);
  }

  function deleteExercise() {
    if (window.confirm(`Übung „${exercise.name}“ wirklich aus diesem Workout entfernen?`)) {
      onDeleteExercise();
    }
  }

  return (
    <>
      <article className="panel overflow-hidden">
        <div className="space-y-2 border-b border-line p-3 sm:p-4">
          {!compact ? (
            <div className="min-w-0">
              <label htmlFor={`exercise-name-${exercise.id}`} className="sr-only">
                Übungsname
              </label>
              <input
                id={`exercise-name-${exercise.id}`}
                className="field text-center font-display text-lg font-bold sm:text-2xl"
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                  setRenameError('');
                }}
                onBlur={() => {
                  if (draftName.trim() && draftName !== exercise.name) {
                    setRenameError(onRenameExercise(draftName) ?? '');
                  } else {
                    setDraftName(exercise.name);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
              />
              {renameError ? <p role="alert" className="mt-2 text-sm text-ember">{renameError}</p> : null}
            </div>
          ) : null}

          <WorkoutGoal exercise={exercise} settings={libraryEntry?.settings} onChange={onUpdateGoal} />
          {lastWorkoutSummary || lastWorkoutCommentText || machineSettingsText ? <div
            className={`workout-reference grid gap-x-5 gap-y-1.5 bg-surface-raised px-3 py-2 text-sm leading-5 ${
              machineSettingsText ? 'md:grid-cols-2' : ''
            }`}
          >
            {lastWorkoutSummary || lastWorkoutCommentText ? <div className="min-w-0 break-words">
              <button type="button" onClick={() => setHistoryOpen(true)}
                className="mr-2 min-h-6 text-[10px] font-bold uppercase tracking-wider text-amber-deep underline underline-offset-2"
                aria-label={`Bisherige Trainings für ${exercise.name} öffnen`}>Zuletzt ↗</button>
              {lastWorkoutSummary && <span className="text-ink">{lastWorkoutSummary}</span>}
              {lastWorkoutCommentText && <span className={`text-xs italic text-muted ${lastWorkoutSummary ? 'block' : ''}`}>{lastWorkoutCommentText}</span>}
            </div> : null}
            {machineSettingsText ? (
              <p className="min-w-0 break-words text-muted">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider">Setup</span>
                {machineSettingsText}
              </p>
            ) : null}
          </div> : null}

          <div
            className="flex flex-wrap items-center gap-2"
            role="toolbar"
            aria-label="Übungsaktionen"
          >
            <button
              type="button"
              onClick={onInsertExercise}
              className={compactIconButtonClass}
              aria-label="Übung einfügen"
              title="Übung einfügen"
            >
              <PlusIcon />
            </button>
            {onMoveExercise && (
              <button
                type="button"
                onClick={onMoveExercise}
                className={compactIconButtonClass}
                aria-label="Übung verschieben"
                aria-haspopup="dialog"
                title="Übung verschieben"
              >
                <InterfaceIcon name="reorder" />
              </button>
            )}
            <Link
              to={`/exercises/${exercise.exerciseId}/chart`}
              state={{ returnTo: `${location.pathname}${location.search}` }}
              className={compactIconButtonClass}
              aria-label="Übungsverlauf als Diagramm öffnen"
              title="Übungsverlauf öffnen"
            >
              <ChartIcon />
            </Link>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className={compactIconButtonClass}
              aria-label="Übung bearbeiten"
              title="Name und Einstellungen bearbeiten"
            >
              <InterfaceIcon name="settings" />
            </button>
            <button
              type="button"
              onClick={deleteExercise}
              className={`${compactIconButtonClass} border-ember/35 bg-ember/10 text-ember hover:border-ember hover:text-ember`}
              aria-label="Übung löschen"
              title="Übung löschen"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
            <div>
              <p className="eyebrow">Sätze · {exercise.sets.length}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 min-[380px]:flex">
              {exercise.sets.length ? (
                <button type="button" onClick={repeatLastSet} className="secondary-button w-full min-[380px]:w-auto">
                  Wiederholen
                </button>
              ) : null}
              <button
                type="button"
                onClick={openNewSet}
                className={`action-button w-full min-[380px]:w-auto ${exercise.sets.length ? '' : 'col-span-2'}`}
              >
                {durationExercise ? 'Stoppuhr' : '+ Satz'}
              </button>
            </div>
          </div>

          {exercise.sets.length ? (
            <div className="divide-y divide-line border-y border-line">
              {exercise.sets.map((setItem, index) => (
                <div
                  key={setItem.id}
                  className={`grid gap-3 px-2 py-3 transition sm:grid-cols-[70px_150px_minmax(0,1fr)_auto] sm:items-center ${
                    recentlySaved === setItem.id ? 'bg-amber-soft' : 'hover:bg-surface-raised'
                  }`}
                >
                  <div>
                    <span className="eyebrow">{setItem.setType === 'warmup' ? 'Aufwärmsatz' : 'Satz'} {String(index + 1).padStart(2, '0')}</span>
                    {formatSetTime(setItem.savedAt) ? <time dateTime={setItem.savedAt} className="mt-1 block text-xs tabular-nums text-muted">
                      {formatSetTime(setItem.savedAt)} Uhr
                    </time> : null}
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums text-ink">
                    {renderSetSummary(setItem)}
                  </p>
                  {setItem.comment ? (
                    <div className="min-w-0 text-xs italic text-muted">
                      <p className="truncate">{setItem.comment}</p>
                    </div>
                  ) : null}
                  <div className="flex gap-2 sm:col-start-4">
                    <button type="button" onClick={() => editSet(setItem)} className="secondary-button">
                      Ändern
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Satz ${index + 1} wirklich löschen?`)) {
                          onDeleteSet(setItem.id);
                        }
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ember/35 bg-ember/10 text-ember transition hover:border-ember hover:bg-ember/15"
                      aria-label={`Satz ${index + 1} löschen`}
                      title={`Satz ${index + 1} löschen`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-line px-4 py-7 text-center text-sm text-muted">
              Noch keine Sätze
            </div>
          )}
          <div ref={bottomAnchorRef} />
        </div>
      </article>

      {historyOpen ? <ExerciseHistoryModal exerciseName={exercise.name} history={exerciseHistory} onClose={() => setHistoryOpen(false)} /> : null}
      <SetEntryModal
        isOpen={setModalOpen}
        initialSet={editingSet}
        goal={exercise.goal}
        plannedQuantity={nextGoalQuantity(exercise)}
        timerSetup={timerSetup}
        exerciseName={exercise.name}
        exerciseSettings={libraryEntry?.settings}
        lastWorkoutSummary={lastWorkoutSummary}
        weightOptions={weightSuggestions ?? getExerciseWeightSuggestions(libraryEntry?.weightOptions, [], exercise.exerciseId, libraryEntry?.settings)}
        onClose={() => setSetModalOpen(false)}
        onSave={saveModalValues}
      />
      <StopwatchModal
        targetSeconds={nextGoalQuantity(exercise)}
        isOpen={timerOpen}
        exerciseName={exercise.name}
        loadValues={timerLoad}
        onClose={() => setTimerOpen(false)}
        onSave={saveSet}
        onEditLoad={libraryEntry?.settings?.loadType === 'none' ? undefined : configureTimerLoad}
      />
      <ExerciseSettingsModal
        isOpen={settingsModalOpen}
        exerciseName={exercise.name}
        settings={libraryEntry?.settings}
        onClose={() => setSettingsModalOpen(false)}
        onSave={onUpdateExerciseSettings}
      />
    </>
  );
}
