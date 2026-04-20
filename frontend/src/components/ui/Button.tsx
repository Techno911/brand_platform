import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    'bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] text-white border border-[#4F46E5] ' +
    'disabled:bg-[#A5B4FC] disabled:border-[#A5B4FC] disabled:text-white disabled:cursor-not-allowed',
  secondary:
    'bg-white hover:bg-[#F5F5F4] active:bg-[#E7E5E4] text-[#1A1A1A] border border-[#E7E5E4] ' +
    'disabled:text-[#A8A29E] disabled:cursor-not-allowed',
  ghost:
    'bg-transparent hover:bg-[#F5F5F4] active:bg-[#E7E5E4] text-[#44403C] border border-transparent ' +
    'disabled:text-[#A8A29E] disabled:cursor-not-allowed',
  danger:
    'bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white border border-[#EF4444] ' +
    'disabled:bg-[#FCA5A5] disabled:border-[#FCA5A5] disabled:cursor-not-allowed',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconLeft: IconLeft,
    iconRight: IconRight,
    loading = false,
    disabled,
    fullWidth = false,
    children,
    className = '',
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-medium',
        'transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:outline-none',
        'active:scale-[0.98] disabled:active:scale-100',
        'select-none whitespace-nowrap',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className={`${ICON_SIZE[size]} spin`} aria-hidden />
      ) : IconLeft ? (
        <IconLeft className={ICON_SIZE[size]} aria-hidden />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight className={ICON_SIZE[size]} aria-hidden /> : null}
    </button>
  );
});

export default Button;
