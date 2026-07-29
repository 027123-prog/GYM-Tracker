import { useEffect, useRef } from 'react';

export default function ModalShell({ isOpen, onClose, labelledBy, maxWidth = 'max-w-lg', children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    window.requestAnimationFrame(() => {
      const preferredFocus = dialog?.querySelector('[autofocus]');
      (preferredFocus ?? dialog?.querySelector(focusableSelector))?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 px-0 pt-10 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`panel max-h-[92dvh] w-full overflow-y-auto rounded-b-none border-b-0 p-5 sm:rounded-md sm:border-b sm:p-6 ${maxWidth}`}
      >
        {children}
      </div>
    </div>
  );
}
