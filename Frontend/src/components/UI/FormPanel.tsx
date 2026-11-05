import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

/** z-index pairs (backdrop, panel); a panel opened from another sits one layer up. */
const LAYERS = [
  { backdrop: 'z-[100]', panel: 'z-[101]' },
  { backdrop: 'z-[110]', panel: 'z-[111]' },
  { backdrop: 'z-[120]', panel: 'z-[121]' },
] as const;

/**
 * A right-hand panel for creating or editing something, in the details-panel
 * style (UI/PanelSection): a white header, one scrolling body of sections, and
 * a footer of buttons, all inside a form. Escape and the backdrop close it; the
 * page behind doesn't scroll.
 *
 * `layer` stacks a panel opened from another one above it, and `covered` tells
 * the lower one that Escape belongs to the panel on top.
 */
const FormPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  testId: string;
  header: React.ReactNode;
  footer: React.ReactNode;
  bodyRef?: React.Ref<HTMLDivElement>;
  layer?: 0 | 1 | 2;
  covered?: boolean;
  children: React.ReactNode;
}> = ({ open, onClose, onSubmit, testId, header, footer, bodyRef, layer = 0, covered = false, children }) => {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || covered) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, covered, onClose]);

  if (!open) return null;
  const z = LAYERS[layer];

  return createPortal(
    <>
      <div className={`fixed inset-0 bg-black/40 ${z.backdrop}`} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className={`fixed inset-y-0 right-0 w-full md:w-[560px] bg-white shadow-2xl ${z.panel} flex flex-col`}
      >
        <div className="flex items-start gap-3 px-5 md:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex-1 min-h-0 flex flex-col">
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain" data-testid={`${testId}-scroll`}>
            {children}
          </div>
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 md:px-6 py-3">{footer}</div>
        </form>
      </div>
    </>,
    document.body
  );
};

/** An inline problem at the top of a panel's form. */
export const FormError: React.FC<{ message: string | null; testId?: string }> = ({ message, testId = 'form-error' }) =>
  message ? (
    <div role="alert" className="mx-5 md:mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700" data-testid={testId}>
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  ) : null;

/** A labelled field: small plain-case label above, an optional hint below. */
export const Field: React.FC<{ label: string; required?: boolean; hint?: React.ReactNode; wide?: boolean; children: React.ReactNode }> = ({ label, required, hint, wide, children }) => (
  <label className={`block min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="block text-[11px] font-medium text-gray-500 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </span>
    {children}
    {hint && <span className="block mt-1 text-[11px] text-gray-400">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full h-9 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

/** Footer buttons, shared so every panel's footer reads the same. */
export const secondaryButton =
  'h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors';
export const primaryButton =
  'h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const dangerButton =
  'h-9 px-3 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors';

export default FormPanel;
