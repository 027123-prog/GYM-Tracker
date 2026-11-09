import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container) {
  return [...container.querySelectorAll(focusableSelector)].filter((element) => element.getClientRects().length);
}

export default function AnchoredPopover({
  isOpen,
  anchorRef,
  onClose,
  labelledBy,
  label,
  id,
  maxWidth = 224,
  children,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return undefined;
    let frameId = 0;
    let closing = false;
    let restoreFocus = true;

    function close(restore = true) {
      if (closing) return;
      closing = true;
      restoreFocus = restore;
      onCloseRef.current();
    }

    function positionPanel() {
      if (closing) return;
      const bounds = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 8;
      const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
      let visibleLeft = leftEdge;
      let visibleRight = rightEdge;
      let visibleTop = topEdge;
      let visibleBottom = bottomEdge;

      // An app scroller can hide its trigger even while it is inside the window.
      for (let parent = anchor.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const styles = window.getComputedStyle(parent);
        const parentBounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(styles.overflowX)) {
          visibleLeft = Math.max(visibleLeft, parentBounds.left);
          visibleRight = Math.min(visibleRight, parentBounds.right);
        }
        if (/(auto|scroll|hidden|clip)/.test(styles.overflowY)) {
          visibleTop = Math.max(visibleTop, parentBounds.top);
          visibleBottom = Math.min(visibleBottom, parentBounds.bottom);
        }
      }

      if (!anchor.isConnected || !bounds.width || bounds.bottom <= visibleTop || bounds.top >= visibleBottom
        || bounds.right <= visibleLeft || bounds.left >= visibleRight) {
        close();
        return;
      }

      const width = Math.min(maxWidth, Math.max(0, rightEdge - leftEdge));
      panel.style.width = `${width}px`;
      const naturalHeight = panel.scrollHeight + 2;
      const below = Math.max(0, bottomEdge - bounds.bottom - 6);
      const above = Math.max(0, bounds.top - topEdge - 6);
      const placeBelow = naturalHeight <= below || below >= above;
      const maxHeight = placeBelow ? below : above;
      if (maxHeight < 44) {
        close();
        return;
      }
      panel.style.maxHeight = `${maxHeight}px`;
      panel.style.left = `${Math.max(leftEdge, Math.min(bounds.right - width, rightEdge - width))}px`;
      panel.style.top = `${placeBelow ? bounds.bottom + 6 : bounds.top - 6 - Math.min(naturalHeight, maxHeight)}px`;
      panel.style.visibility = 'visible';
    }

    function schedulePosition(event) {
      if (event?.target instanceof Node && panel.contains(event.target)) return;
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(positionPanel);
    }

    function handlePointerDown(event) {
      if (!panel.contains(event.target) && !anchor.contains(event.target)) close();
    }

    function handleFocus(event) {
      if (!panel.contains(event.target) && !anchor.contains(event.target)) close(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (!panel.contains(document.activeElement)) return;
      const items = focusableElements(panel);
      const currentIndex = items.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[index].focus();
      } else if (event.key === 'Tab' && ((event.shiftKey && currentIndex <= 0) || (!event.shiftKey && currentIndex === items.length - 1))) {
        event.preventDefault();
        const outsideItems = focusableElements(document).filter((element) => !panel.contains(element));
        const anchorIndex = outsideItems.indexOf(anchor);
        const next = event.shiftKey ? anchor : outsideItems[anchorIndex + 1] ?? anchor;
        close(false);
        next.focus({ preventScroll: true });
      }
    }

    positionPanel();
    if (!closing) (panel.querySelector('[data-autofocus]') ?? focusableElements(panel)[0] ?? panel).focus({ preventScroll: true });
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', schedulePosition, true);
    window.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    const observer = new ResizeObserver(schedulePosition);
    observer.observe(anchor);
    observer.observe(panel);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
      if (restoreFocus && anchor.isConnected && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
        anchor.focus({ preventScroll: true });
      }
    };
  }, [isOpen, anchorRef, maxWidth]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-labelledby={labelledBy}
      aria-label={label}
      tabIndex={-1}
      className="panel fixed z-[70] overflow-y-auto overscroll-contain p-2"
      style={{ width: maxWidth, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
