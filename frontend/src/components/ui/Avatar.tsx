import type { HTMLAttributes } from 'react';

// BP Avatar — portированный из RO SaaS (/Users/techno/Desktop/ЧиП/frontend/src/components/ui/avatar.tsx),
// адаптирован под BP палитру (indigo #4F46E5 вместо RO orange #F97316) и без внешнего lib/utils.
// Использование: Sidebar footer, future client cards, comment threads.

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLS: Record<Size, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export interface AvatarProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  name: string;
  src?: string | null;
  /** Кастомный hex для fallback-фона; по умолчанию indigo #4F46E5. */
  color?: string | null;
  size?: Size;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Avatar({
  name,
  src,
  color,
  size = 'md',
  className = '',
  ...rest
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={[
          'rounded-full object-cover flex-shrink-0',
          SIZE_CLS[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...(rest as HTMLAttributes<HTMLImageElement>)}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={[
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none',
        SIZE_CLS[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: color ?? '#4F46E5', color: '#FFFFFF' }}
      {...rest}
    >
      {getInitials(name)}
    </div>
  );
}
