import * as THREE from 'three';
import { createMuscleFigure } from './createMuscleFigure';
import { fitFigureCamera, lightMuscleFigure } from './figureScene';

// All library cards share one model and one WebGL context. Each visible card
// receives a synchronous copy of its own colored render in a plain 2D canvas.
let shared;
let shutdownTimer;
const MAX_DRAWS_PER_TICK = 6;

function createService() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  lightMuscleFigure(renderer, scene);
  const camera = new THREE.OrthographicCamera(-0.7, 0.7, 1.015, -1.015, 0.1, 20);
  camera.position.set(0, 1.05, 4);
  camera.lookAt(0, 0.95, 0);
  const entries = new Set();
  let figure, frame = null, disposed = false, failed = false, lastTick = -Infinity, cursor = 0;
  let renderWidth = 0, renderHeight = 0;
  const suspend = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
  const fail = () => {
    failed = true; suspend();
    for (const entry of entries) entry.onStatus('failed');
  };
  const requestDraw = () => {
    if (!disposed && !failed && figure && entries.size && !document.hidden && frame === null) frame = requestAnimationFrame(draw);
  };
  function draw(time) {
    frame = null;
    if (disposed || failed || document.hidden || !entries.size) return;
    if (time - lastTick >= 1000 / 30) {
      lastTick = time;
      const pending = [...entries].filter(entry => entry.dirty);
      const count = Math.min(MAX_DRAWS_PER_TICK, pending.length);
      for (let index = 0; index < count; index++) {
        const entry = pending[(cursor + index) % pending.length];
        const { canvas } = entry;
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) continue;
        const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
        const width = Math.max(1, Math.round(bounds.width * ratio));
        const height = Math.max(1, Math.round(bounds.height * ratio));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        if (renderWidth !== width || renderHeight !== height) {
          renderer.setSize(width, height, false); renderWidth = width; renderHeight = height;
        }
        fitFigureCamera(camera, width, height);
        figure.root.rotation.y = entry.angle;
        figure.setLevels(entry.muscles);
        try {
          renderer.render(scene, camera);
          entry.context.clearRect(0, 0, width, height);
          entry.context.drawImage(renderer.domElement, 0, 0);
        } catch { fail(); return; }
        entry.dirty = false;
        if (!entry.ready) { entry.ready = true; entry.onStatus('ready'); }
      }
      cursor = pending.length ? (cursor + count) % pending.length : 0;
    }
    if ([...entries].some(entry => entry.dirty)) requestDraw();
  }
  const visibility = () => { if (document.hidden) suspend(); else requestDraw(); };
  const contextLost = event => { event.preventDefault(); fail(); };
  document.addEventListener('visibilitychange', visibility);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  createMuscleFigure().then(asset => {
    if (disposed) { asset.dispose(); return; }
    figure = asset; scene.add(asset.root); requestDraw();
  }).catch(fail);
  return {
    entries,
    register(canvas, muscles, onStatus, angle) {
      const context = canvas.getContext('2d');
      if (failed || !context) { onStatus('failed'); return { update() {}, setAngle() {}, dispose() {} }; }
      const entry = { canvas, context, muscles, onStatus, angle, ready: false, dirty: true };
      entries.add(entry); onStatus('loading'); requestDraw();
      return {
        update(next) { entry.muscles = next; entry.dirty = true; requestDraw(); },
        setAngle(next) { if (!Number.isFinite(next)) return; entry.angle = next; entry.dirty = true; requestDraw(); },
        dispose() { entries.delete(entry); if (!entries.size) suspend(); canvas.width = 1; canvas.height = 1; },
      };
    },
    dispose() {
      disposed = true; suspend();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      figure?.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

export function registerExercisePreview(canvas, muscles, onStatus, angle = 0) {
  clearTimeout(shutdownTimer);
  try { shared ??= createService(); }
  catch { onStatus('failed'); return { update() {}, setAngle() {}, dispose() {} }; }
  const service = shared;
  const registration = service.register(canvas, muscles, onStatus, Number.isFinite(angle) ? angle : 0);
  return {
    update: registration.update,
    setAngle: registration.setAngle,
    dispose() {
      registration.dispose();
      if (!service.entries.size) shutdownTimer = setTimeout(() => {
        if (shared === service && !service.entries.size) { service.dispose(); shared = undefined; }
      }, 10000);
    },
  };
}
