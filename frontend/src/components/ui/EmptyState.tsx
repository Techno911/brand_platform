import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact variant — без большой иконки, для встраивания в карточки */
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div
        className={[
          'flex flex-col items-center justify-center text-center py-8 px-4',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {Icon && <Icon className="w-6 h-6 text-[#A8A29E] mb-2" aria-hidden />}
        <p className="text-sm font-medium text-[#44403C]">{title}</p>
        {description && <p className="text-xs text-[#78716C] mt-1">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-[#F5F5F4] flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-[#A8A29E]" aria-hidden />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[#1A1A1A]">{title}</h3>
      {description && (
        <p className="text-sm text-[#78716C] mt-2 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
