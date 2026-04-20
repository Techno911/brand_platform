import { useState, useRef, useId } from 'react';
import type { ReactNode } from 'react';

type Position = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: Position;
  delay?: number;
  disabled?: boolean;
}

export interface TooltipRichProps {
  title?: string;
  children: ReactNode;
  content: ReactNode;
  link?: { href: string; label: string };
  position?: Position;
  delay?: number;
  disabled?: boolean;
}

const positionClasses: Record<Position, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

function Tooltip({ text, children, position = 'top', delay = 300, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  const show = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`absolute ${positionClasses[position]} px-3 py-2
            bg-[#1A1A1A] text-white text-xs rounded-lg whitespace-nowrap z-50
            pointer-events-none shadow-[0_4px_12px_0_rgba(0,0,0,0.15)]`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function TooltipRich({
  title,
  children,
  content,
  link,
  position = 'top',
  delay = 300,
  disabled = false,
}: TooltipRichProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  const show = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible && (
        <div
          id={id}
          role="tooltip"
          className={`absolute ${positionClasses[position]} px-4 py-3
            bg-[#1A1A1A] text-white rounded-lg z-50 w-72
            shadow-[0_12px_40px_0_rgba(0,0,0,0.25)] border border-[#44403C]`}
        >
          {title && <p className="text-sm font-semibold mb-1">{title}</p>}
          <div className="text-xs text-[#D6D3D1] leading-relaxed">{content}</div>
          {link && (
            <a
              href={link.href}
              className="text-xs text-[#A5B4FC] hover:text-[#818CF8] mt-2 inline-block font-medium"
              target="_blank"
              rel="noreferrer"
            >
              {link.label} →
            </a>
          )}
        </div>
      )}
    </span>
  );
}

type TooltipCompound = typeof Tooltip & { Rich: typeof TooltipRich };
const TooltipWithSlots = Tooltip as TooltipCompound;
TooltipWithSlots.Rich = TooltipRich;

export default TooltipWithSlots;
