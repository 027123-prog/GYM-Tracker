import { useEffect, useRef, useState } from 'react';
import { registerExercisePreview } from './exercisePreviewRenderer';
import { bindExercisePreviewInteraction } from './exercisePreviewInteraction';

export default function ExerciseMusclePreview({ muscles, label, initialView = 'front', onAngleCommit }) {
  const canvasRef = useRef(null);
  const registrationRef = useRef(null);
  const musclesRef = useRef(muscles);
  const angleRef = useRef(initialView === 'back' ? Math.PI : 0);
  const defaultAngleRef = useRef(angleRef.current);
  const manuallyRotatedRef = useRef(false);
  const [staticView, setStaticView] = useState(initialView);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    defaultAngleRef.current = initialView === 'back' ? Math.PI : 0;
    if (!manuallyRotatedRef.current) {
      angleRef.current = defaultAngleRef.current;
      registrationRef.current?.setAngle(angleRef.current);
      setStaticView(initialView);
    }
  }, [initialView]);
  useEffect(() => {
    musclesRef.current = muscles;
    registrationRef.current?.update(muscles);
  }, [muscles]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const rotate = (angle, manual = true) => {
      manuallyRotatedRef.current = manual;
      angleRef.current = angle;
      registrationRef.current?.setAngle(angle);
      setStaticView(Math.cos(angle) < 0 ? 'back' : 'front');
    };
    const unbind = bindExercisePreviewInteraction(canvas, {
      getAngle: () => angleRef.current, getDefaultAngle: () => defaultAngleRef.current, onRotate: rotate, onAngleCommit,
    });
    const activate = () => {
      if (!registrationRef.current) registrationRef.current = registerExercisePreview(canvas, musclesRef.current, setStatus, angleRef.current);
    };
    const deactivate = () => { registrationRef.current?.dispose(); registrationRef.current = null; };
    const observer = window.IntersectionObserver ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) activate(); else deactivate();
    }) : null;
    if (observer) observer.observe(canvas); else activate();
    const resize = window.ResizeObserver ? new ResizeObserver(() => registrationRef.current?.update(musclesRef.current)) : null;
    resize?.observe(canvas);
    return () => {
      observer?.disconnect(); resize?.disconnect(); deactivate();
      unbind();
    };
  }, [onAngleCommit]);
  return <div className="exercise-muscle-preview" role="img" aria-label={status === 'failed' ? `${label} 3D nicht verfügbar; neutrale Ersatzansicht.` : label}>
    <canvas ref={canvasRef} aria-hidden="true" />
    {status !== 'ready' ? <img className="muscle-figure-static pointer-events-none" src={`${import.meta.env.BASE_URL}anatomy/fallback-${staticView}.png`} alt="" /> : null}
    {status === 'failed' ? <span className="muscle-figure-failure-note">3D nicht verfügbar</span> : null}
  </div>;
}
