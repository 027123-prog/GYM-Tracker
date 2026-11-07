import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatSetWeight, isWeightlessSet } from '../utils/setMeasurements';
import { createStopwatchSetPayload, formatStopwatchTime, getStopwatchElapsedSeconds } from '../utils/stopwatch';

export default function StopwatchModal({ isOpen, exerciseName, loadValues, onClose, onSave, onEditLoad }) {
  const [phase, setPhase] = useState('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const timerButtonRef = useRef(null);
  const startedAtRef = useRef(null);
  const phaseRef = useRef('ready');
  const stoppedSecondsRef = useRef(0);
  const runLoadRef = useRef(null);
  const saveInProgressRef = useRef(false);
  const sessionRef = useRef(0);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    sessionRef.current += 1;
    phaseRef.current = 'ready';
    startedAtRef.current = null;
    stoppedSecondsRef.current = 0;
    runLoadRef.current = null;
    saveInProgressRef.current = false;
    setPhase('ready');
    setElapsedSeconds(0);
    setError('');
    setSaving(false);
    return () => { sessionRef.current += 1; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || phase !== 'running') return undefined;
    const updateTime = () => setElapsedSeconds(getStopwatchElapsedSeconds(startedAtRef.current));
    const intervalId = window.setInterval(updateTime, 200);
    document.addEventListener('visibilitychange', updateTime);
    window.addEventListener('focus', updateTime);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', updateTime);
      window.removeEventListener('focus', updateTime);
    };
  }, [isOpen, phase]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const appScroller = document.querySelector('[data-app-scroll-container]');
    const previousBodyOverflow = document.body.style.overflow;
    const previousAppOverflow = appScroller?.style.overflow ?? '';
    const previousAppTouchAction = appScroller?.style.touchAction ?? '';
    document.body.style.overflow = 'hidden';
    if (appScroller) {
      appScroller.style.overflow = 'hidden';
      appScroller.style.touchAction = 'none';
    }
    const frameId = window.requestAnimationFrame(() => timerButtonRef.current?.focus({ preventScroll: true }));

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function containFocus(event) {
      if (dialog && !dialog.contains(event.target)) timerButtonRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', containFocus);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', containFocus);
      document.body.style.overflow = previousBodyOverflow;
      if (appScroller) {
        appScroller.style.overflow = previousAppOverflow;
        appScroller.style.touchAction = previousAppTouchAction;
      }
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  async function handleTap() {
    if (saveInProgressRef.current) return;
    if (phaseRef.current === 'ready') {
      runLoadRef.current = { ...loadValues };
      startedAtRef.current = Date.now();
      phaseRef.current = 'running';
      setPhase('running');
      return;
    }

    if (phaseRef.current === 'running') {
      stoppedSecondsRef.current = Math.max(1, getStopwatchElapsedSeconds(startedAtRef.current));
      phaseRef.current = 'stopped';
      setPhase('stopped');
      setElapsedSeconds(stoppedSecondsRef.current);
    }

    const payload = createStopwatchSetPayload(runLoadRef.current, stoppedSecondsRef.current);
    if (!payload) {
      setError('Gewicht prüfen und Stoppuhr erneut öffnen.');
      return;
    }

    saveInProgressRef.current = true;
    setSaving(true);
    setError('');
    const session = sessionRef.current;
    try {
      const savedId = await onSave(payload);
      if (session !== sessionRef.current) return;
      if (savedId) {
        onCloseRef.current();
        return;
      }
    } catch {
      // Keep the measured duration available for another save attempt.
    }
    if (session !== sessionRef.current) return;
    saveInProgressRef.current = false;
    setSaving(false);
    setError('Nicht gespeichert. Zum Wiederholen tippen.');
  }

  if (!isOpen) return null;
  const time = formatStopwatchTime(elapsedSeconds);
  const instruction = saving ? 'Speichert …' : phase === 'ready' ? 'Tippen zum Starten' : 'Tippen zum Speichern';
  const hasLoad = loadValues && !isWeightlessSet(loadValues);

  return createPortal(
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stopwatch-title"
      onClick={handleTap}
      className="fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-paper text-ink"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <h2 id="stopwatch-title" className="pt-2 text-sm font-bold text-muted">{exerciseName || 'Stoppuhr'}</h2>
        <button type="button" onClick={(event) => { event.stopPropagation(); onClose(); }} className="icon-button" aria-label="Stoppuhr abbrechen">×</button>
      </div>

      {phase === 'ready' && hasLoad ? (
        <div className="flex shrink-0 items-center justify-center gap-2 px-5 text-sm text-muted">
          <span>{formatSetWeight(loadValues)}</span>
          {onEditLoad ? <button type="button" onClick={(event) => { event.stopPropagation(); onEditLoad(); }} className="min-h-11 px-3 font-semibold text-amber">Ändern</button> : null}
        </div>
      ) : null}

      <button
        ref={timerButtonRef}
        type="button"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!event.repeat) handleTap();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
        }}
        aria-label={phase === 'ready' ? 'Stoppuhr starten' : 'Stoppuhr stoppen und Satz speichern'}
        aria-busy={saving}
        className="flex min-h-0 w-full flex-1 select-none flex-col items-center justify-center gap-5 px-3 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none focus-visible:outline-offset-[-4px]"
      >
        <span
          role="timer"
          aria-live="off"
          className="font-display font-bold leading-none tabular-nums tracking-tight"
          style={{ fontSize: time.length > 5 ? 'min(17vw, 42dvh, 12rem)' : 'min(27vw, 42dvh, 18rem)' }}
        >
          {time}
        </span>
        <span className="text-sm text-muted">{instruction}</span>
        {error ? <span role="alert" className="max-w-sm text-center text-sm font-semibold text-ember">{error}</span> : null}
      </button>
    </section>,
    document.body,
  );
}
