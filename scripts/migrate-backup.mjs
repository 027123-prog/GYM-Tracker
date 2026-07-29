import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBackupPayload, parseBackupPayload } from '../src/utils/storage.js';

const [, , inputArgument, outputArgument] = process.argv;

if (!inputArgument || !outputArgument) {
  throw new Error('Nutzung: node scripts/migrate-backup.mjs <eingabe.json> <ausgabe.json>');
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const source = await readFile(inputPath, 'utf8');
const state = parseBackupPayload(source);
const payload = createBackupPayload(state);

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

process.stdout.write(
  JSON.stringify({
    outputPath,
    storageVersion: payload.storageVersion,
    summary: payload.summary,
  }),
);
