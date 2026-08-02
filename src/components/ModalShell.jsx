import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ModalShell({
  isOpen,
  onClose,
  labelledBy,
  maxWidth = 'max-w-lg',
  mobilePosition = 'bottom',
  children,
}) {
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFrameId = window.requestAnimationFrame(() => {
      const preferredFocus = dialog?.querySelector('[data-autofocus]');
      (preferredFocus ?? dialog?.querySelector(focusableSelector))?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) {
        return;
      }

      const focusable = [...dialog.querySelectorAll(focusableSelector)];

      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialog.contains(document.activeElement)) {
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

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrameId);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !window.visualViewport || !overlayRef.current) {
      return undefined;
    }

    const viewport = window.visualViewport;
    const overlay = overlayRef.current;
    let frameId = 0;

    function syncToVisibleViewport() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        overlay.style.top = `${Math.max(0, viewport.offsetTop)}px`;
        overlay.style.height = `${viewport.height}px`;
        overlay.style.bottom = 'auto';
        overlay.style.setProperty('--modal-viewport-height', `${viewport.height}px`);
      });
    }

    syncToVisibleViewport();
    viewport.addEventListener('resize', syncToVisibleViewport);
    viewport.addEventListener('scroll', syncToVisibleViewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport.removeEventListener('resize', syncToVisibleViewport);
      viewport.removeEventListener('scroll', syncToVisibleViewport);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const appScrollContainer = document.querySelector('[data-app-scroll-container]');
    const previousBodyOverflow = document.body.style.overflow;
    const previousAppOverflow = appScrollContainer?.style.overflow ?? '';
    const previousAppTouchAction = appScrollContainer?.style.touchAction ?? '';

    document.body.style.overflow = 'hidden';

    if (appScrollContainer) {
      appScrollContainer.style.overflow = 'hidden';
      appScrollContainer.style.touchAction = 'none';
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;

      if (appScrollContainer) {
        appScrollContainer.style.overflow = previousAppOverflow;
        appScrollContainer.style.touchAction = previousAppTouchAction;
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const topAligned = mobilePosition === 'top';

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[60] flex justify-center overscroll-contain bg-black/75 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6 ${
        topAligned
          ? 'items-start px-2 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]'
          : 'items-end px-0 pt-4'
      }`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`panel max-h-[calc(100%_-_1rem)] w-full overscroll-contain overflow-y-auto p-5 sm:max-h-full sm:rounded-md sm:border-b sm:p-6 ${
          topAligned ? 'rounded-sm' : 'rounded-b-none border-b-0'
        } ${maxWidth}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
