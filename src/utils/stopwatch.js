import { prepareSetValues } from './setMeasurements';

export const MAX_STOPWATCH_SECONDS = 86400;

export function getStopwatchElapsedSeconds(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 0;
  return Math.min(MAX_STOPWATCH_SECONDS, Math.max(0, Math.floor((now - startedAt) / 100) / 10));
}

export function formatStopwatchTime(seconds) {
  const tenths = Number.isFinite(seconds) ? Math.floor(Math.min(MAX_STOPWATCH_SECONDS, Math.max(0, seconds)) * 10) : 0;
  const whole = Math.floor(tenths / 10);
  const minutes = Math.floor(whole / 60) % 60;
  const remainingSeconds = whole % 60;
  const pad = (value) => String(value).padStart(2, '0');
  const time = whole >= 3600
    ? `${pad(Math.floor(whole / 3600))}:${pad(minutes)}:${pad(remainingSeconds)}`
    : `${pad(minutes)}:${pad(remainingSeconds)}`;
  return `${time},${tenths % 10}`;
}

export function createStopwatchSetPayload(loadValues, elapsedSeconds) {
  if (!loadValues || !Number.isFinite(elapsedSeconds)) return null;
  const durationSeconds = Math.min(MAX_STOPWATCH_SECONDS, Math.max(1, Math.floor(elapsedSeconds)));
  const { values, error } = prepareSetValues({
    ...loadValues,
    measurementType: 'duration',
    durationSeconds,
    reps: 0,
  });
  return error ? null : { ...values, comment: '' };
}
