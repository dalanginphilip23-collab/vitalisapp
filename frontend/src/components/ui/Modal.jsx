import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon.jsx';

const SIZES = {
  sm: 'max-w-[360px]',
  md: 'max-w-[420px]',
  lg: 'max-w-[480px]',
  xl: 'max-w-[560px]',
  full: 'max-w-[90vw] max-h-[90vh] max-h-[90dvh]',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  children,
  footer,
  hideClose = false,
  className = '',
  headerClassName = '',
}) {
  const cardRef = useRef(null);
  const previousActiveRef = useRef(null);
  const titleId = useId();

  // Lock body scroll + restore focus
  useEffect(() => {
    if (!isOpen) return;
    previousActiveRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // focus card
    requestAnimationFrame(() => cardRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      // restore focus
      if (previousActiveRef.current && typeof previousActiveRef.current.focus === 'function') {
        previousActiveRef.current.focus();
      }
    };
  }, [isOpen]);

  // ESC handling + focus trap
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
      // focus trap: keep tab within modal
      if (e.key === 'Tab' && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sizeClass = SIZES[size] || SIZES.md;

  return createPortal(
    <>
      <style>{`@keyframes modalBackdropIn{from{opacity:0}to{opacity:1}}@keyframes modalCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-[var(--bg-overlay)]"
        style={{ animation: 'modalBackdropIn 0.2s ease forwards', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))', paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
        onMouseDown={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div
          ref={cardRef}
          tabIndex={-1}
          className={`bg-[var(--bg-card)] shadow-2xl border border-[var(--border-light)] w-full ${sizeClass} rounded-2xl overflow-hidden flex flex-col max-h-[90vh] max-h-[90dvh] outline-none ${className}`}
          style={{ animation: 'modalCardIn 0.25s var(--ease-default) forwards' }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || subtitle || icon || !hideClose) && (
            <div className={`flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--border-light)] bg-transparent shrink-0 ${headerClassName}`}>
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
                    <Icon name={icon} className="text-[16px] text-[var(--accent)]" />
                  </div>
                )}
                <div className="min-w-0">
                  {title && <h3 id={titleId} className="text-[14px] font-bold text-[var(--text-primary)] leading-tight break-words">{title}</h3>}
                  {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 break-words">{subtitle}</p>}
                </div>
              </div>
              {!hideClose && (
                <button
                  onClick={onClose}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                  aria-label="Close dialog"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              )}
            </div>
          )}

          <div className="overflow-y-auto flex-1 p-5 sm:p-6" style={{ scrollbarWidth: 'thin' }}>
            {children}
          </div>

          {footer && (
            <div className="px-5 sm:px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)] shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
