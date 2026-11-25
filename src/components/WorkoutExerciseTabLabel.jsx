import { splitExerciseName } from '../utils/workoutPresentation';
import { getGoalProgress } from '../utils/workoutGoals';
import { GoalBar } from './WorkoutGoal';

export default function WorkoutExerciseTabLabel({ exercise, index, showGoal = false }) {
  const { mainName, nameDetail } = splitExerciseName(exercise.name);

  return (
    <span className="block w-full min-w-0">
      <span className="block text-[10px] font-bold uppercase leading-3 tracking-[0.14em] text-amber-deep">
        {String(index + 1).padStart(2, '0')} · {exercise.skipped ? 'Übersprungen' : `${exercise.sets.length} Sätze`}
      </span>
      <span className="mt-1 flex h-7 w-full flex-col justify-center">
        <span className="block w-full truncate text-sm font-bold leading-4">{mainName}</span>
        {nameDetail ? (
          <span className="block w-full truncate text-[10px] leading-3 text-muted">{nameDetail}</span>
        ) : null}
      </span>
      {showGoal && exercise.goal && <GoalBar percent={getGoalProgress(exercise).percent} name={exercise.name} />}
    </span>
  );
}
