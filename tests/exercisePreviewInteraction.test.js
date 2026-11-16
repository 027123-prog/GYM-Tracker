import test from 'node:test';
import assert from 'node:assert/strict';
import { bindExercisePreviewInteraction } from '../src/components/muscle/exercisePreviewInteraction.js';

class Target {
  listeners = new Map();
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); }
  send(name, values = {}) {
    const event = { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, button: 0,
      defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
    this.listeners.get(name)?.(event);
    return event;
  }
}
function setup() {
  const oldWindow = globalThis.window;
  const canvas = new Target(), link = new Target(), taskWindow = new Target();
  globalThis.window = taskWindow;
  canvas.closest = () => link;
  let capture = null, angle = Math.PI;
  const rotations = [];
  canvas.hasPointerCapture = id => capture === id;
  canvas.setPointerCapture = id => { capture = id; };
  canvas.releasePointerCapture = () => { capture = null; };
  const dispose = bindExercisePreviewInteraction(canvas, { getAngle: () => angle, getDefaultAngle: () => Math.PI,
    onRotate(value, manual) { angle = value; rotations.push({ value, manual }); } });
  return { canvas, link, taskWindow, rotations, get angle() { return angle; },
    restore() { dispose(); if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; } };
}

test('horizontal dragging rotates only that figure and suppresses the following navigation click; taps still open normally', () => {
  const env = setup();
  try {
    env.canvas.send('pointerdown');
    env.canvas.send('pointermove', { clientX: 40, clientY: 1 });
    assert.equal(env.angle, Math.PI + 0.48);
    env.taskWindow.send('pointerup');
    assert.equal(env.canvas.hasPointerCapture(1), false);
    const dragClick = env.canvas.send('click');
    assert.equal(dragClick.defaultPrevented, true); assert.equal(dragClick.stopped, true);
    env.canvas.send('pointerdown'); env.taskWindow.send('pointerup');
    assert.equal(env.canvas.send('click').defaultPrevented, false);
    assert.equal(env.angle, Math.PI + 0.48);
  } finally { env.restore(); }
});

test('vertical scrolling, tiny movement and secondary pointers do not rotate a card', () => {
  const env = setup();
  try {
    env.canvas.send('pointerdown');
    assert.equal(env.canvas.send('pointermove', { clientX: 2, clientY: 30 }).defaultPrevented, false);
    env.canvas.send('pointermove', { clientX: 50, clientY: 31 });
    assert.equal(env.rotations.length, 0);
    env.canvas.send('pointerdown'); env.canvas.send('pointermove', { clientX: 3 }); env.taskWindow.send('pointerup');
    assert.equal(env.canvas.send('click').defaultPrevented, false);
    env.canvas.send('pointerdown', { isPrimary: false }); env.canvas.send('pointermove', { clientX: 40 });
    assert.equal(env.rotations.length, 0);
  } finally { env.restore(); }
});

test('arrow keys rotate one card, Home restores its exercise side, Enter remains navigation and listeners are removed', () => {
  const env = setup();
  try {
    assert.equal(env.link.send('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
    assert.equal(env.angle, Math.PI + 0.3);
    env.link.send('keydown', { key: 'Home' });
    assert.equal(env.angle, Math.PI); assert.equal(env.rotations.at(-1).manual, false);
    assert.equal(env.link.send('keydown', { key: 'Enter' }).defaultPrevented, false);
  } finally { env.restore(); }
  assert.equal(env.canvas.listeners.size, 0); assert.equal(env.link.listeners.size, 0); assert.equal(env.taskWindow.listeners.size, 0);
});
