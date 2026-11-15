import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calculateMuscleLoad } from '../src/utils/muscleLoad.js';

// Personal inputs/results remain in ignored backups, never in public or src/data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const values = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--source', '--mapping', '--output', '--at'].includes(args[i]) || !args[i + 1]) {
    throw new Error('Usage: node scripts/preview-muscle-load.mjs --source <export.json> --mapping <mapping.json> --output <backups/report-prefix> [--at <ISO-time>]');
  }
  values[args[i].slice(2)] = args[i + 1];
}
if (!values.source || !values.mapping || !values.output) throw new Error('source, mapping and output are required');
const sourcePath = path.resolve(root, values.source);
const mappingPath = path.resolve(root, values.mapping);
const prefix = path.resolve(root, values.output);
const backups = path.join(root, 'backups');
const relative = path.relative(backups, prefix);
if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Private output must be inside backups/');
const outputs = [`${prefix}.json`, `${prefix}.md`];
if (outputs.some(file => [sourcePath.toLowerCase(), mappingPath.toLowerCase()].includes(file.toLowerCase()))) throw new Error('Output would overwrite an input');
const read = (file) => {
  const buffer = fs.readFileSync(file);
  return { json: JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')), hash: crypto.createHash('sha256').update(buffer).digest('hex') };
};
const source = read(sourcePath);
const assignment = read(mappingPath);
const state = source.json.data ?? source.json;
if (!Array.isArray(state.workouts) || !Array.isArray(state.exercises) || !Array.isArray(assignment.json.entries)) throw new Error('Invalid export or mapping');
const result = calculateMuscleLoad({ workouts: state.workouts, exercises: state.exercises, mapping: assignment.json, now: values.at ?? source.json.exportedAt });
const recent = result.sessions.filter(session => session.ageDays <= result.settings.maxAgeDays);
const recentSets = recent.flatMap(session => session.sets);
const diagnosticCounts = Object.fromEntries([...new Set(result.diagnostics.map(item => item.reason))]
  .map(reason => [reason, result.diagnostics.filter(item => item.reason === reason).length]));
const summary = {
  catalogueExercises: state.exercises.length,
  mappedExercises: assignment.json.entries.length,
  evaluatedWorkouts: result.sessions.length,
  recentWorkouts: recent.length,
  evaluatedSets: result.sessions.reduce((sum, session) => sum + session.sets.length, 0),
  recentSets: recentSets.length,
  recentSetsWithReference: recentSets.filter(set => set.reference).length,
  recentSetsWithBaseline: recentSets.filter(set => !set.reference).length,
  diagnosticCounts,
};
const report = {
  source: { path: sourcePath, sha256: source.hash, exportedAt: source.json.exportedAt },
  mapping: { path: mappingPath, sha256: assignment.hash },
  summary,
  ...result,
};
const names = new Map(state.exercises.map(exercise => [exercise.id, exercise.name]));
const decimal = (value) => value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const status = { no_history: 'Keine auswertbare Historie', older_history: 'Ältere Historie', recent_history: 'Kürzlich trainiert' };
const lines = [
  '**Private Diagnose der Muskelbelastung**', '',
  `Berechnet für ${result.evaluatedAt}; Zeitzone ${result.timeZone}; Verfahren ${result.version}.`, '',
  'Interne Prüfausgabe. Die Farbstärke ist ein Darstellungswert, kein Prozentwert für Ermüdung oder Regeneration. Dieser Text erscheint nicht unter der späteren Figur.', '',
  `${summary.catalogueExercises} Katalogübungen; ${summary.mappedExercises} Zuordnungseinträge. ${summary.recentWorkouts} abgeschlossene Trainings im Farbfenster von ${result.settings.maxAgeDays} Tagen. ${summary.recentSets} auswertbare Sätze davon: ${summary.recentSetsWithReference} mit vorheriger Vergleichsbasis, ${summary.recentSetsWithBaseline} mit vorsichtiger Basisschätzung.`, '',
  '**Muskelwerte am Auswertungszeitpunkt**', '',
  '| Region | Rohwert nach Abklingen | Farbstärke 0–1 | Farbe | Zustand |',
  '| --- | --- | --- | --- | --- |',
  ...Object.values(result.muscles).sort((a, b) => b.intensity - a.intensity)
    .map(muscle => `| ${escape(muscle.label)} | ${decimal(muscle.rawLoad)} | ${decimal(muscle.intensity)} | ${muscle.color} | ${status[muscle.status]} |`), '',
  '**Satzbeiträge im Farbfenster**', '',
  '| Trainingstag | Übung | Satz | Protokolliert | Beitrag vor Muskelgewicht/Abklingen | Vorherige Vergleichseinheiten | Hinweise |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...recent.flatMap(session => session.sets.map((set, index) => {
    const quantity = set.measurement === 'duration' ? `${set.quantity} s` : `${set.quantity} Wdh.`;
    const load = set.mode === 'none' ? quantity : `${decimal(set.weight)} kg · ${quantity}`;
    return `| ${escape(session.date)} | ${escape(names.get(set.exerciseId) ?? set.exerciseId)} | ${index + 1} | ${load} | ${decimal(set.contribution)} | ${set.reference?.sessionCount ?? 0} | ${set.warnings.join(', ') || '–'} |`;
  })), '',
  '**Nicht oder eingeschränkt ausgewertete Daten**', '',
  'Die JSON-Datei enthält sämtliche Gründe je Satz/Eintrag. Unklare Varianten, fehlende Zeitfelder, unbekannte Lastkonventionen sowie doppelte oder ungültige Angaben werden nicht stillschweigend ergänzt. Fehlende Referenz, RIR und historische Modusunterschiede stehen zusätzlich an jedem ausgewerteten Satz.', '',
  ...Object.entries(diagnosticCounts).map(([reason, count]) => `- ${reason}: ${count}`), '',
  `Quell-Export SHA-256: ${source.hash}`, `Muskelzuordnung SHA-256: ${assignment.hash}`, '',
];
fs.mkdirSync(path.dirname(prefix), { recursive: true });
fs.writeFileSync(outputs[0], JSON.stringify(report, null, 2) + '\n', 'utf8');
fs.writeFileSync(outputs[1], lines.join('\n'), 'utf8');
// Verify source integrity; outputs contain computed data only.
if (read(sourcePath).hash !== source.hash || read(mappingPath).hash !== assignment.hash) throw new Error('Inputs changed during calculation');
console.log(JSON.stringify({ ...summary, output: outputs, sourceUnchanged: true }));
