import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const usage = 'node scripts/read-training.mjs [--last ANZAHL | --all | --help]';
const services = [
  { source: 'zuhause-dashboard', url: 'http://127.0.0.1:8770/api/gym/trainingsstand', label: 'Zuhause-Dashboard' },
  { source: 'pc-service', url: 'http://127.0.0.1:4175/api/home-sync/state', label: 'Gym-WLAN-Dienst' },
];

function parseOptions(args) {
  if (!args.length) return { mode: 'summary' };
  if (args.length === 1 && args[0] === '--help') return { mode: 'help' };
  if (args.length === 1 && args[0] === '--all') return { mode: 'all' };
  if (args.length === 2 && args[0] === '--last' && /^[1-9]\d*$/.test(args[1]) && Number.isSafeInteger(Number(args[1]))) {
    return { mode: 'recent', count: Number(args[1]) };
  }
  throw new Error('Erwartet wird ' + usage);
}

function validate(snapshot) {
  const { revision, state } = snapshot ?? {};
  if (!Number.isSafeInteger(revision) || revision < 0
    || (revision === 0 ? state !== null
      : !['workouts', 'exercises', 'templates', 'maxStrengthRecords'].every(k => Array.isArray(state?.[k])))) {
    throw new Error('Ungültiger Abgleichstand.');
  }
  return { revision, state };
}

async function snapshotFromPc(fetchImpl, read, localAppData) {
  const issues = [];
  for (const service of services) {
    try {
      const reply = await fetchImpl(service.url, {
        method: 'GET', headers: { 'X-HardGain-Sync': '1' }, redirect: 'error', signal: AbortSignal.timeout(3000),
      });
      if (reply.status !== 200) {
        issues.push(service.label + ' meldet HTTP ' + reply.status + '.');
        continue;
      }
      try {
        return { source: service.source, ...validate(await reply.json()) };
      } catch {
        issues.push(service.label + ' liefert einen ungültigen Abgleichstand.');
      }
    } catch {
      issues.push(service.label + ' ist nicht erreichbar.');
    }
  }
  const apiIssue = issues.join(' ');
  if (!localAppData || !isAbsolute(localAppData)) throw new Error(apiIssue + ' Der private PC-Speicher ist nicht verfügbar.');
  let raw;
  try {
    raw = await read(join(localAppData, 'HardGainWAF', 'home-sync', 'state.json'), 'utf8');
  } catch (error) {
    throw new Error(apiIssue + (error.code === 'ENOENT' ? ' Auf diesem PC liegt kein gespeicherter Abgleichstand vor.'
      : ' Der gespeicherte Abgleichstand ist nicht lesbar.'));
  }
  try {
    return { source: 'private-file', ...validate(JSON.parse(raw.replace(/^\uFEFF/, ''))) };
  } catch {
    throw new Error('Der gespeicherte Abgleichstand ist ungültig.');
  }
}

function workoutTime(workout) {
  for (const field of ['date', 'completedAt', 'updatedAt']) {
    const time = Date.parse(workout[field]);
    if (Number.isFinite(time)) return time;
  }
  return -Infinity;
}

export async function readTraining(args, { fetchImpl = fetch, read = readFile, localAppData = process.env.LOCALAPPDATA } = {}) {
  const { mode, count } = parseOptions(args);
  if (mode === 'help') return usage + '\nOhne Argumente erscheint die Übersicht. --last N zeigt N vollständige Trainings, --all den gesamten synchronisierten App-Datenbestand als JSON.';
  const { source, revision, state } = await snapshotFromPc(fetchImpl, read, localAppData);
  const meta = { source, revision, status: state === null ? 'awaiting-first-sync' : 'ready' };
  if (mode === 'all') return { ...meta, state };
  const workouts = [...(state?.workouts ?? [])].sort((a, b) => workoutTime(b) - workoutTime(a));
  if (mode === 'recent') return { ...meta, workouts: workouts.slice(0, count) };
  const latest = workouts[0];
  return {
    ...meta, workoutCount: workouts.length, exerciseCount: state?.exercises.length ?? 0,
    templateCount: state?.templates.length ?? 0, strengthRecordCount: state?.maxStrengthRecords.length ?? 0,
    latestWorkout: latest ? { id: latest.id, name: latest.name, date: latest.date, completedAt: latest.completedAt ?? null } : null,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await readTraining(process.argv.slice(2));
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
