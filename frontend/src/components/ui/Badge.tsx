import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'solid' | 'outline' | 'soft';
type Color = 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  color?: Color;
  icon?: LucideIcon;
  children?: ReactNode;
}

const SOLID: Record<Color, string> = {
  primary: 'bg-[#4F46E5] text-white border-transparent',
  neutral: 'bg-[#1A1A1A] text-white border-transparent',
  success: 'bg-[#22C55E] text-white border-transparent',
  warning: 'bg-[#EAB308] text-white border-transparent',
  danger: 'bg-[#EF4444] text-white border-transparent',
  info: 'bg-[#3B82F6] text-white border-transparent',
};

const SOFT: Record<Color, string> = {
  primary: 'bg-[#EEF2FF] text-[#3730A3] border-transparent',
  neutral: 'bg-[#F5F5F4] text-[#44403C] border-transparent',
  success: 'bg-[#F0FDF4] text-[#15803D] border-transparent',
  warning: 'bg-[#FEFCE8] text-[#A16207] border-transparent',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-transparent',
  info: 'bg-[#EFF6FF] text-[#1D4ED8] border-transparent',
};

const OUTLINE: Record<Color, string> = {
  primary: 'bg-transparent text-[#3730A3] border-[#A5B4FC]',
  neutral: 'bg-transparent text-[#44403C] border-[#D6D3D1]',
  success: 'bg-transparent text-[#15803D] border-[#86EFAC]',
  warning: 'bg-transparent text-[#A16207] border-[#FDE047]',
  danger: 'bg-transparent text-[#B91C1C] border-[#FCA5A5]',
  info: 'bg-transparent text-[#1D4ED8] border-[#BFDBFE]',
};

export default function Badge({
  variant = 'soft',
  color = 'neutral',
  icon: Icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const cls =
    variant === 'solid' ? SOLID[color] : variant === 'outline' ? OUTLINE[color] : SOFT[color];

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5',
        'rounded-md text-xs font-semibold leading-5 border',
        cls,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {Icon && <Icon className="w-3 h-3" aria-hidden />}
      {children}
    </span>
  );
}
