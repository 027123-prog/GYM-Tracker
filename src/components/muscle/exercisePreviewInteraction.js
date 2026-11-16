export function bindExercisePreviewInteraction(canvas, { getAngle, getDefaultAngle, onRotate }) {
  let dragging = null, suppressClick = false;
  const down = event => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    suppressClick = false;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: getAngle(), horizontal: false };
  };
  const move = event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    if (!dragging.horizontal && Math.abs(dy) > Math.max(6, Math.abs(dx))) { dragging = null; return; }
    if (!dragging.horizontal && Math.abs(dx) < 6) return;
    dragging.horizontal = true; suppressClick = true;
    if (!canvas.hasPointerCapture(event.pointerId)) canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    onRotate(dragging.angle + dx * 0.012, true);
  };
  const up = event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    dragging = null;
  };
  const cancel = event => { up(event); suppressClick = false; };
  const click = event => {
    if (!suppressClick) return;
    event.preventDefault(); event.stopPropagation(); suppressClick = false;
  };
  // Arrow keys on the surrounding card link rotate only this figure.
  // Enter and taps without a drag retain the link's normal navigation.
  const link = canvas.closest('a');
  const keydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    onRotate(event.key === 'Home' ? getDefaultAngle() : getAngle() + (event.key === 'ArrowLeft' ? -0.3 : 0.3), event.key !== 'Home');
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('click', click, true);
  link?.addEventListener('keydown', keydown);
  return () => {
    if (dragging && canvas.hasPointerCapture(dragging.id)) canvas.releasePointerCapture(dragging.id);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('click', click, true);
    link?.removeEventListener('keydown', keydown);
  };
}
