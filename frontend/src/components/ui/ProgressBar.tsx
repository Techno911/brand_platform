import type { HTMLAttributes } from 'react';

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Значение от 0 до 100 */
  value: number;
  /** Цветовая семантика */
  color?: 'primary' | 'success' | 'warning' | 'danger';
  /** Высота в px (дефолт 6) */
  height?: number;
  /** Подпись (ARIA) */
  ariaLabel?: string;
  /** Показывать ли числовое значение справа */
  showValue?: boolean;
  /** Суффикс после числа (например '%', ' ₽') */
  valueSuffix?: string;
}

const COLOR_CLS = {
  primary: 'bg-[#4F46E5]',
  success: 'bg-[#22C55E]',
  warning: 'bg-[#EAB308]',
  danger: 'bg-[#EF4444]',
};

export default function ProgressBar({
  value,
  color = 'primary',
  height = 6,
  ariaLabel,
  showValue = false,
  valueSuffix = '%',
  className = '',
  ...rest
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')} {...rest}>
      <div className="flex items-center gap-3">
        <div
          className="flex-1 overflow-hidden rounded-full bg-[#F5F5F4]"
          style={{ height }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={ariaLabel}
        >
          <div
            className={[COLOR_CLS[color], 'h-full transition-[width] duration-300 ease-out'].join(' ')}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {showValue && (
          <span className="text-xs font-mono text-[#44403C] tabular-nums flex-shrink-0">
            {Math.round(clamped)}
            {valueSuffix}
          </span>
        )}
      </div>
    </div>
  );
}
