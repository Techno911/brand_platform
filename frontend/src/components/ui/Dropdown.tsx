import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DropdownItem {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export default function Dropdown({ trigger, items, align = 'left', className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={['relative inline-flex', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={[
            'absolute top-full mt-2 min-w-56 z-40',
            'bg-white/95 backdrop-blur-md rounded-lg border border-[#E7E5E4]',
            'shadow-[0_12px_40px_0_rgba(0,0,0,0.15)] py-1',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={idx} className="my-1 border-t border-[#F5F5F4]" />;
            }
            const Icon = item.icon;
            const cls = [
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
              'transition-colors duration-200',
              item.disabled
                ? 'text-[#A8A29E] cursor-not-allowed'
                : item.danger
                ? 'text-[#DC2626] hover:bg-[#FEF2F2]'
                : 'text-[#1A1A1A] hover:bg-[#F5F5F4]',
            ].join(' ');

            const content = (
              <>
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />}
                <span className="truncate">{item.label}</span>
              </>
            );

            if (item.href && !item.disabled) {
              return (
                <a
                  key={idx}
                  href={item.href}
                  role="menuitem"
                  className={cls}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={cls}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
