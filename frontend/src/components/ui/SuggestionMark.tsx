import type { ReactNode, MouseEvent } from 'react';

export interface SuggestionMarkProps {
  /** Уникальный ID suggestion — связь с thread справа */
  id: string;
  /** Автор комментария — показывается в tooltip */
  author?: string;
  /** Статус — управляет визуалом */
  status?: 'open' | 'resolved' | 'rejected';
  /** Активный (выделен кликом) — подсвечивается ярче */
  active?: boolean;
  /** Колбэк клика — обычно scroll-focus на thread */
  onFocus?: (id: string) => void;
  children: ReactNode;
}

const STATUS_CLS: Record<NonNullable<SuggestionMarkProps['status']>, string> = {
  open: 'underline decoration-[#EAB308] decoration-dotted decoration-2 bg-[#FEFCE8]/60',
  resolved: 'underline decoration-[#22C55E] decoration-solid decoration-1 bg-[#F0FDF4]/40',
  rejected: 'line-through decoration-[#A8A29E] decoration-1 text-[#A8A29E]',
};

export default function SuggestionMark({
  id,
  author,
  status = 'open',
  active = false,
  onFocus,
  children,
}: SuggestionMarkProps) {
  const handleClick = (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    onFocus?.(id);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus?.(id);
        }
      }}
      aria-label={author ? `Комментарий: ${author}` : 'Комментарий'}
      title={author ? `Комментарий: ${author}` : undefined}
      data-suggestion-id={id}
      data-status={status}
      className={[
        'cursor-pointer rounded-sm px-0.5 -mx-0.5 transition-colors duration-200',
        STATUS_CLS[status],
        active ? 'ring-2 ring-[#4F46E5] ring-offset-1 ring-offset-white' : '',
        status === 'open' && active ? 'suggestion-pulse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
