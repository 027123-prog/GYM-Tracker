import { useEffect, useRef, useState } from 'react';
import { registerExercisePreview } from './exercisePreviewRenderer';

export default function ExerciseMusclePreview({ muscles, label }) {
  const canvasRef = useRef(null);
  const registrationRef = useRef(null);
  const musclesRef = useRef(muscles);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    musclesRef.current = muscles;
    registrationRef.current?.update(muscles);
  }, [muscles]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const activate = () => {
      if (!registrationRef.current) registrationRef.current = registerExercisePreview(canvas, musclesRef.current, setStatus);
    };
    const deactivate = () => { registrationRef.current?.dispose(); registrationRef.current = null; };
    if (!window.IntersectionObserver) { activate(); return deactivate; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) activate(); else deactivate();
    });
    observer.observe(canvas);
    const resize = new ResizeObserver(() => registrationRef.current?.update(musclesRef.current));
    resize.observe(canvas);
    return () => { observer.disconnect(); resize.disconnect(); deactivate(); };
  }, []);
  return <div className="exercise-muscle-preview" role="img" aria-label={status === 'failed' ? `${label} 3D nicht verfügbar; neutrale Ersatzansicht.` : label}>
    <canvas ref={canvasRef} aria-hidden="true" />
    {status !== 'ready' ? <img className="muscle-figure-static" src={`${import.meta.env.BASE_URL}anatomy/fallback-front.png`} alt="" /> : null}
    {status === 'failed' ? <span className="muscle-figure-failure-note">3D nicht verfügbar</span> : null}
  </div>;
}
