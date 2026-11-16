import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function setup({ reduced = false } = {}) {
  const originals = Object.fromEntries(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', '__previewTest'].map(key => [key, globalThis[key]]));
  const frames = new Map(), timers = new Map(), listeners = new Map();
  let sequence = 0;
  const stats = { contexts: 0, loads: 0, disposedModels: 0, disposedRenderers: 0, renders: [], colors: null };
  const media = { matches: reduced, addEventListener(_, fn) { this.changed = fn; }, removeEventListener() {} };
  globalThis.__previewTest = stats;
  globalThis.window = { devicePixelRatio: 2, matchMedia: () => media };
  globalThis.document = { hidden: false, addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } };
  globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.setTimeout = fn => { timers.set(++sequence, fn); return sequence; };
  globalThis.clearTimeout = id => timers.delete(id);
  const fakeThree = `
    const stats=globalThis.__previewTest;
    class Object3D { position={set(){}}; rotation={y:0}; add(){}; lookAt(){}; updateProjectionMatrix(){}; }
    export class Scene extends Object3D {}
    export class OrthographicCamera extends Object3D {}
    export class HemisphereLight extends Object3D {}
    export class DirectionalLight extends Object3D {}
    export class WebGLRenderer {
      domElement={addEventListener(){},removeEventListener(){}};
      constructor(){stats.contexts++}
      setPixelRatio(){} setClearColor(){} setSize(){}
      render(){stats.renders.push(stats.colors)}
      dispose(){stats.disposedRenderers++} forceContextLoss(){}
    }
    export const SRGBColorSpace='srgb', ACESFilmicToneMapping='aces';`;
  const result = await build({ entryPoints: ['src/components/muscle/exercisePreviewRenderer.js'], bundle: true,
    platform: 'node', format: 'esm', write: false, plugins: [{ name: 'renderer-boundaries', setup(builder) {
      builder.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'test' }));
      builder.onResolve({ filter: /createMuscleFigure$/ }, () => ({ path: 'figure', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'three' ? fakeThree : `
        export async function createMuscleFigure(){ const stats=globalThis.__previewTest; stats.loads++;
          return {root:{rotation:{y:0}},setLevels(value){stats.colors=value},dispose(){stats.disposedModels++}}; }` }));
    } }] });
  const module = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text + `\n// ${Math.random()}`).toString('base64'));
  const canvas = () => ({ width: 0, height: 0, copied: [], getBoundingClientRect: () => ({ width: 160, height: 240 }),
    getContext() { return { clearRect() {}, drawImage: () => this.copied.push(stats.renders.at(-1)) }; } });
  return { ...module, stats, frames, timers, listeners, media, canvas,
    async tick(time) { await Promise.resolve(); const current = [...frames.values()]; frames.clear(); current.forEach(fn => fn(time)); },
    restore() { for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } },
  };
}

test('many exercise cards share a single graphics context and model; colors stay per card and rendering is bounded and fair', async () => {
  const env = await setup();
  try {
    const cards = Array.from({ length: 20 }, (_, index) => ({ canvas: env.canvas(), colors: { region: { intensity: index / 20 } } }));
    const registrations = cards.map(card => env.registerExercisePreview(card.canvas, card.colors, () => {}));
    await env.tick(100);
    assert.equal(env.stats.contexts, 1); assert.equal(env.stats.loads, 1);
    assert.equal(env.stats.renders.length, 6);
    for (const time of [200, 300, 400]) await env.tick(time);
    assert.ok(cards.every(card => card.canvas.copied.length > 0));
    assert.ok(cards.every(card => card.canvas.copied.every(colors => colors === card.colors)));
    const changed = { different: { intensity: 1 } };
    registrations[0].update(changed);
    for (const time of [500, 600, 700, 800]) await env.tick(time);
    assert.equal(cards[0].canvas.copied.at(-1), changed);
    registrations.slice(1).forEach(registration => registration.dispose());
    assert.equal(env.timers.size, 0);
    registrations[0].dispose();
    assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 1);
    [...env.timers.values()][0]();
    assert.equal(env.stats.disposedModels, 1); assert.equal(env.stats.disposedRenderers, 1);
    assert.equal(env.listeners.size, 0);
  } finally { env.restore(); }
});

test('reduced motion renders still profiles and updates changes; background tabs stop drawing', async () => {
  const env = await setup({ reduced: true });
  try {
    const registration = env.registerExercisePreview(env.canvas(), { quads: { intensity: 1 } }, () => {});
    await env.tick(100); assert.equal(env.frames.size, 0);
    registration.update({ lats: { intensity: 1 } });
    await env.tick(200); assert.equal(env.stats.renders.length, 2); assert.equal(env.frames.size, 0);
    env.media.matches = false; env.media.changed();
    await env.tick(300); assert.equal(env.frames.size, 1);
    document.hidden = true; env.listeners.get('visibilitychange')(); assert.equal(env.frames.size, 0);
    document.hidden = false; env.listeners.get('visibilitychange')(); await env.tick(400);
    assert.equal(env.stats.renders.length, 4);
    registration.dispose(); [...env.timers.values()][0]();
  } finally { env.restore(); }
});

test('a missing 2D canvas fails explicitly and still releases the shared graphics resources', async () => {
  const env = await setup();
  try {
    let status;
    const registration = env.registerExercisePreview({ getContext: () => null }, {}, value => { status = value; });
    await Promise.resolve();
    assert.equal(status, 'failed'); assert.equal(env.frames.size, 0);
    registration.dispose(); [...env.timers.values()][0]();
    assert.equal(env.stats.disposedModels, 1); assert.equal(env.stats.disposedRenderers, 1);
  } finally { env.restore(); }
});
