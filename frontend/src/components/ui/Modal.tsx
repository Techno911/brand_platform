import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Ширина панели в px (дефолт 520) */
  width?: number;
  /** Закрывать ли по клику на overlay (дефолт true) */
  closeOnOverlay?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
  closeOnOverlay = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus panel ONLY при открытии. Если сюда добавить [onClose] — каждый вызов setState
  // у родителя даст новый onClose reference, эффект пересработает, panelRef.focus() украдёт
  // фокус у поля ввода на каждом нажатии клавиши. Не объединять с keydown-эффектом.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  // Escape + lock body scroll. onClose обязан быть в deps, иначе stale closure.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/60 backdrop-blur-sm"
      onClick={closeOnOverlay ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-desc' : undefined}
        tabIndex={-1}
        style={{ width, maxWidth: '100%' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-[0_12px_40px_0_rgba(0,0,0,0.15)] modal-enter
          max-h-[90vh] flex flex-col overflow-hidden focus:outline-none"
      >
        {(title || description) && (
          <div className="px-6 pt-5 pb-3 border-b border-[#F5F5F4] flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-[#1A1A1A] leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm text-[#78716C] mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="text-[#78716C] hover:text-[#1A1A1A] p-1 -m-1 rounded-lg
                hover:bg-[#F5F5F4] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#F5F5F4] flex items-center justify-end gap-3 bg-[#FAFAF9]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
