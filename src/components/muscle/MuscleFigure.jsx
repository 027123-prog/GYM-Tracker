import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createMuscleFigure } from './createMuscleFigure';
import { fitFigureCamera, lightMuscleFigure } from './figureScene';
import './muscleFigure.css';

export default function MuscleFigure({ muscles = {}, className = '', controls = true, ariaLabel, initialView, initialAngle, focusRequest }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const musclesRef = useRef(muscles);
  const [playing, setPlaying] = useState(() => !initialView && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const startAngle = Number.isFinite(initialAngle) ? initialAngle : initialView === 'back' ? Math.PI : initialView === 'front' ? 0 : -0.15;
  const [staticView, setStaticView] = useState(Math.cos(startAngle) < 0 ? 'back' : 'front');
  const highlighted = useRef(null);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; sceneRef.current?.requestDraw(); }, [playing]);
  useEffect(() => {
    musclesRef.current = muscles;
    sceneRef.current?.figure.setLevels(muscles, highlighted.current);
    sceneRef.current?.requestDraw();
  }, [muscles]);

  useEffect(() => {
    const host = containerRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setFailed(true); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const scene = new THREE.Scene();
    lightMuscleFigure(renderer, scene);
    const camera = new THREE.OrthographicCamera(-0.7, 0.7, 2, 0, 0.1, 20);
    camera.position.set(0, 1.05, 4);
    camera.lookAt(0, 0.95, 0);
    let disposed = false;
    const figure = { root: new THREE.Group(), setLevels() {}, dispose() {} };
    figure.root.rotation.y = startAngle;
    scene.add(figure.root);
    createMuscleFigure().then(asset => {
      if (disposed) { asset.dispose(); return; }
      figure.root.add(asset.root);
      figure.setLevels = asset.setLevels;
      figure.dispose = asset.dispose;
      figure.setLevels(musclesRef.current);
      setLoading(false);
      requestDraw();
    }).catch(() => { if (!disposed) { setLoading(false); setFailed(true); } });
    let frame = null;
    let previous = 0;
    let lastDraw = 0;
    let visible = true;
    let dragging = null;
    let turn = null;
    let dirty = true;
    const draw = (time) => {
      frame = null;
      const elapsed = previous ? Math.min((time - previous) / 1000, 0.08) : 0;
      previous = time;
      const moving = playingRef.current && !dragging;
      if (turn) {
        const progress = Math.min(1, Math.max(0, (time - turn.start) / 320));
        figure.root.rotation.y = turn.from + turn.distance * progress * progress * (3 - 2 * progress);
        if (progress === 1) { turn = null; dirty = true; }
      } else if (moving) figure.root.rotation.y += elapsed * Math.PI * 2 / 15;
      if (dirty || time - lastDraw >= 1000 / 30) {
        renderer.render(scene, camera);
        lastDraw = time;
        dirty = false;
      }
      if ((moving || turn) && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const requestDraw = () => {
      dirty = true;
      if (visible && !document.hidden && frame === null) {
        previous = 0;
        frame = requestAnimationFrame(draw);
      }
    };
    const suspend = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = 0;
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      fitFigureCamera(camera, width, height);
      renderer.setSize(width, height);
      requestDraw();
    });
    resize.observe(host);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestDraw(); else suspend();
    });
    intersection.observe(host);
    const visibility = () => { if (document.hidden) suspend(); else requestDraw(); };
    document.addEventListener('visibilitychange', visibility);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { if (reduced.matches) setPlaying(false); };
    reduced.addEventListener('change', preference);
    const down = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      turn = null;
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: figure.root.rotation.y, horizontal: false };
      // Keep vertical scrolling available until horizontal intent is established.
    };
    const move = (event) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      if (!dragging.horizontal && Math.abs(dx) < 6) return;
      if (!dragging.horizontal && Math.abs(dy) > Math.abs(dx)) { dragging = null; requestDraw(); return; }
      dragging.horizontal = true;
      if (!canvas.hasPointerCapture(event.pointerId)) canvas.setPointerCapture(event.pointerId);
      figure.root.rotation.y = dragging.angle + dx * 0.012;
      requestDraw();
    };
    const up = (event) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragging = null;
      requestDraw();
    };
    const contextLost = (event) => { event.preventDefault(); suspend(); setFailed(true); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('webglcontextlost', contextLost);
    sceneRef.current = { figure, requestDraw, setAngle(angle, animate = false) {
      playingRef.current = false;
      const from = figure.root.rotation.y;
      const distance = Math.atan2(Math.sin(angle - from), Math.cos(angle - from));
      turn = animate && !reduced.matches && Math.abs(distance) > 0.01
        ? { from, distance, start: performance.now() } : null;
      if (!turn) figure.root.rotation.y = angle;
      setPlaying(false);
      requestDraw();
    } };
    requestDraw();
    return () => {
      disposed = true;
      suspend();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('webglcontextlost', contextLost);
      figure.dispose();
      renderer.dispose();
      canvas.remove();
      sceneRef.current = null;
    };
  }, [startAngle]);

  useEffect(() => {
    if (!focusRequest) return;
    setStaticView(focusRequest.view);
    sceneRef.current?.setAngle(focusRequest.angle, true);
  }, [focusRequest]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!focusRequest || !scene || failed || loading) return;
    highlighted.current = focusRequest.id;
    scene.figure.setLevels(musclesRef.current, focusRequest.id);
    scene.requestDraw();
    const restore = () => {
      highlighted.current = null;
      scene.figure.setLevels(musclesRef.current);
      scene.requestDraw();
    };
    const timer = window.setTimeout(restore, 2400);
    return () => {
      window.clearTimeout(timer);
      if (highlighted.current && sceneRef.current === scene) restore();
      highlighted.current = null;
    };
  }, [focusRequest, failed, loading]);

  return (
    <div className={`muscle-figure ${className}`}>
      <div ref={containerRef} className="muscle-figure-stage" data-failed={failed} role="img" aria-label={failed ? 'Statische anatomische Ansicht ohne Belastungsfarben. 3D ist nicht verfügbar.' : ariaLabel || 'Drehbare anatomische Körperfigur. Rotabstufungen zeigen geschätzte Trainingsbelastung.'}>
        {loading && !failed ? <div className="muscle-figure-fallback" role="status" aria-label="Muskelkarte lädt">{controls ? 'Muskelkarte lädt …' : <img className="muscle-figure-static" src={`${import.meta.env.BASE_URL}anatomy/fallback-front.png`} alt="" />}</div> : null}
        {failed ? <><img className="muscle-figure-static" src={`${import.meta.env.BASE_URL}anatomy/fallback-${staticView}.png`} alt="" />{controls ? <span className="muscle-figure-failure-note">Statische Ansicht · 3D nicht verfügbar</span> : null}</> : null}
      </div>
      {controls ? <div className="muscle-figure-tools" aria-label="Körperansicht steuern">
        <button type="button" title="Vorderseite" aria-label="Vorderseite anzeigen" onClick={() => { setStaticView('front'); sceneRef.current?.setAngle(0); }}>Vorn</button>
        <button type="button" title="Rückseite" aria-label="Rückseite anzeigen" onClick={() => { setStaticView('back'); sceneRef.current?.setAngle(Math.PI); }}>Hinten</button>
        <button type="button" disabled={failed} aria-label={playing ? 'Drehung pausieren' : 'Drehung starten'} aria-pressed={!failed && playing} onClick={() => setPlaying(value => !value)}>
          {playing ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 5v10M14 5v10" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" /></svg>}
        </button>
      </div> : null}
    </div>
  );
}
