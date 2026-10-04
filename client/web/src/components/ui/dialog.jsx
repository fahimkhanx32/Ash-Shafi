import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils.js';

/**
 * Minimal, dependency-free dialog primitive (no @radix-ui in this
 * project's package.json, and this sandbox has no network access to
 * add one — see master prompt §3, "do not introduce unnecessary
 * dependencies"). Covers what the roadmap actually needs: portal
 * rendering, Escape-to-close, backdrop-click-to-close, focus moved
 * into the dialog on open, `role="dialog"`/`aria-modal`.
 *
 * CRITICAL FIX: The effect depends ONLY on `open`. `onOpenChange` is
 * stored in a ref so changes to inline handler identities on re-renders
 * NEVER cause the effect to re-run and steal focus from inputs inside
 * the dialog while the user is actively typing.
 */
export function Dialog({ open, onOpenChange, children, className }) {
  const contentRef = useRef(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;

    // Move focus into the dialog container ONLY once when it opens,
    // and only if focus is not already on an element inside it.
    if (contentRef.current && !contentRef.current.contains(document.activeElement)) {
      contentRef.current.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onOpenChangeRef.current?.(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previouslyFocused instanceof HTMLElement && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChangeRef.current?.(false)}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-one-ui-lg outline-none animate-zoom-in my-auto shrink-0',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 pr-6', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-bold tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-2', className)} {...props} />;
}

export function DialogCloseButton({ onClose }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="absolute right-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-xl p-2 transition-colors active:scale-95"
    >
      <X size={18} />
    </button>
  );
}
