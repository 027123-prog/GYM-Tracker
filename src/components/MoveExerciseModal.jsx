import { useLayoutEffect, useRef, useState } from 'react';
import ModalShell from './ModalShell';
import WorkoutExerciseTabLabel from './WorkoutExerciseTabLabel';

const SCROLL_EDGE = 48;

function getDragPosition(drag, list) {
  const distance = drag.pointerY - drag.startY + list.scrollTop - drag.startScrollTop;
  const offset = Math.max(-drag.index * drag.step, Math.min((list.children.length - 1 - drag.index) * drag.step, distance));
  return { offset, target: drag.index + Math.round(offset / drag.step) };
}

export default function MoveExerciseModal({ isOpen, exercise, exercises, onClose, onMove }) {
  const currentIndex = exercises.findIndex((entry) => entry.id === exercise?.id);
  const listRef = useRef(null);
  const selectedRef = useRef(null);
  const dragRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    setPreview(null);
    setError('');
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
    return () => {
      if (dragRef.current) cancelAnimationFrame(dragRef.current.frame);
      dragRef.current = null;
    };
  }, [isOpen, exercise?.id]);

  function moveTo(index) {
    if (index === currentIndex || index < 0 || index >= exercises.length) return;
    setError(onMove(index) || '');
    selectedRef.current?.focus({ preventScroll: true });
  }

  function startDrag(event) {
    if (event.button !== 0 || dragRef.current) return;
    const list = listRef.current;
    const step = list.children[1].offsetTop - list.children[0].offsetTop;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId, index: currentIndex, step,
      startY: event.clientY, pointerY: event.clientY, startScrollTop: list.scrollTop,
    };

    function animate() {
      const drag = dragRef.current;
      const { top, bottom } = list.getBoundingClientRect();
      const topEdge = top + SCROLL_EDGE;
      const bottomEdge = bottom - SCROLL_EDGE;
      const edgeDistance = drag.pointerY < topEdge ? drag.pointerY - topEdge : Math.max(0, drag.pointerY - bottomEdge);
      const scroll = Math.max(-SCROLL_EDGE, Math.min(SCROLL_EDGE, edgeDistance));
      if (scroll && Math.abs(drag.pointerY - drag.startY) > 4) list.scrollTop += scroll * 0.24;

      const position = getDragPosition(drag, list);
      setPreview((previous) => previous?.offset === position.offset ? previous : position);
      drag.frame = requestAnimationFrame(animate);
    }

    dragRef.current.frame = requestAnimationFrame(animate);
  }

  function updateDrag(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current.pointerY = event.clientY;
  }

  function endDrag(event, drop) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    cancelAnimationFrame(drag.frame);
    setPreview(null);
    if (drop) {
      drag.pointerY = event.clientY;
      moveTo(getDragPosition(drag, listRef.current).target);
    }
  }

  function handleArrowKey(event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    moveTo(currentIndex + (event.key === 'ArrowUp' ? -1 : 1));
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="move-exercise-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="move-exercise-title" className="font-display text-2xl font-bold text-ink">Übung verschieben</h2>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Dialog schließen">×</button>
      </div>
      <p className="mb-3 mt-1 text-sm text-muted">Markierte Übung ziehen oder Zielposition antippen.</p>
      <ol ref={listRef} className="relative grid max-h-[60dvh] gap-1.5 overflow-y-auto overscroll-contain p-1">
        {exercises.map((entry, index) => {
          const selected = index === currentIndex;
          let offset = 0;
          if (preview) {
            const step = dragRef.current?.step ?? 0;
            if (selected) offset = preview.offset;
            else if (index > currentIndex && index <= preview.target) offset = -step;
            else if (index < currentIndex && index >= preview.target) offset = step;
          }

          return (
            <li key={entry.id} className={`relative ${selected && preview ? 'z-10' : 'transition-transform'}`}
              style={offset ? { transform: `translateY(${offset}px)` } : undefined}>
              <button
                type="button"
                ref={selected ? selectedRef : undefined}
                data-autofocus={selected ? true : undefined}
                aria-current={selected ? 'step' : undefined}
                aria-label={selected ? `${entry.name} verschieben, Position ${index + 1}` : `An Position ${index + 1} verschieben, ${entry.name}`}
                aria-keyshortcuts={selected ? 'ArrowUp ArrowDown' : undefined}
                title={entry.name}
                onPointerDown={selected ? startDrag : undefined}
                onPointerMove={selected ? updateDrag : undefined}
                onPointerUp={selected ? (event) => endDrag(event, true) : undefined}
                onPointerCancel={selected ? (event) => endDrag(event, false) : undefined}
                onLostPointerCapture={selected ? (event) => endDrag(event, false) : undefined}
                onKeyDown={selected ? handleArrowKey : undefined}
                onClick={selected ? undefined : () => moveTo(index)}
                className={`flex h-[3.5625rem] w-full select-none items-center justify-between gap-3 rounded-sm border px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber ${
                  selected ? 'touch-none cursor-grab border-amber bg-amber-soft text-ink active:cursor-grabbing' : 'border-line bg-paper text-muted hover:border-amber/45 hover:text-ink'
                }`}
              >
                <WorkoutExerciseTabLabel exercise={entry} index={selected && preview ? preview.target : index + Math.sign(offset)} />
                {selected ? <span className="shrink-0 text-lg text-amber-deep" aria-hidden="true">⠿</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {error ? <p role="alert" className="mt-2 text-sm text-ember">{error}</p> : null}
    </ModalShell>
  );
}
