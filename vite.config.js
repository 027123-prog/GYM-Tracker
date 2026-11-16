import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

const version = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const builtAt = Date.now();
const release = { schemaVersion: 1, version, builtAt, buildId: `${version}-${builtAt.toString(36)}` };

export default defineConfig({
  base: './',
  define: { __APP_RELEASE__: JSON.stringify(release) },
  plugins: [react(), {
    name: 'app-release-manifest',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(release) }); },
  }],
});
