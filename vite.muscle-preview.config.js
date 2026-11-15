import { defineConfig, mergeConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './vite.config.js';
import { calculateMuscleLoad } from './src/utils/muscleLoad.js';

const root = path.dirname(fileURLToPath(import.meta.url));
// Opt-in localhost preview only. Personal files are never part of a client import.
export default mergeConfig(base, defineConfig({
  server: { host: '127.0.0.1', port: 5201, strictPort: true },
  plugins: [{
    name: 'private-muscle-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__muscle-preview-data', (request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
        if (!local || request.method !== 'GET') { response.statusCode = 403; response.end('{}'); return; }
        try {
          const read = (file) => JSON.parse(fs.readFileSync(path.join(root, 'backups', file), 'utf8').replace(/^\uFEFF/, ''));
          const source = read('hardgainwaf-backup-2026-11-15T08-49-24-454Z.json');
          const mapping = read('muskelzuordnung-2026-11-15.json');
          const url = new URL(request.url, 'http://127.0.0.1');
          const days = Math.min(14, Math.max(0, Number(url.searchParams.get('days')) || 0));
          const now = new Date(Date.parse(source.exportedAt) + days * 86400000);
          const result = calculateMuscleLoad({ ...source.data, mapping, now });
          const recent = result.sessions.filter(session => session.ageDays <= result.settings.maxAgeDays);
          response.end(JSON.stringify({ available: true, muscles: result.muscles, evaluatedAt: result.evaluatedAt,
            exportedAt: source.exportedAt, workouts: recent.length, sets: recent.reduce((sum, session) => sum + session.sets.length, 0) }));
        } catch {
          response.statusCode = 503;
          response.end(JSON.stringify({ available: false }));
        }
      });
    },
  }],
}));
