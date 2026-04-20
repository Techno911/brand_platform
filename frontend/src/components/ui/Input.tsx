import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Size = 'md' | 'lg';

interface CommonFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  sizeField?: Size;
  iconLeft?: LucideIcon;
  containerClassName?: string;
}

const SIZE_CLS: Record<Size, string> = {
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
};

function fieldClasses(error: boolean, hasIconLeft: boolean, size: Size): string {
  return [
    'w-full rounded-xl border bg-[#F5F5F4]',
    'transition-[background-color,border-color,box-shadow] duration-200',
    'placeholder:text-[#A8A29E] text-[#1A1A1A]',
    'focus:outline-none focus:bg-white',
    error
      ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]'
      : 'border-[#E7E5E4] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]',
    hasIconLeft ? 'pl-10' : 'px-3',
    hasIconLeft ? 'pr-3' : '',
    SIZE_CLS[size],
  ]
    .filter(Boolean)
    .join(' ');
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    CommonFieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    iconLeft: IconLeft,
    sizeField = 'md',
    id,
    containerClassName = '',
    className = '',
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const ariaDescribedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {IconLeft && (
          <IconLeft
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C] pointer-events-none"
            aria-hidden
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={ariaDescribedBy}
          className={[fieldClasses(!!error, !!IconLeft, sizeField), className].filter(Boolean).join(' ')}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-[#DC2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-[#78716C]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    Omit<CommonFieldProps, 'iconLeft'> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    sizeField = 'md',
    id,
    containerClassName = '',
    className = '',
    rows = 5,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const ariaDescribedBy = error ? errorId : hint ? hintId : undefined;
  const base = fieldClasses(!!error, false, sizeField);
  const heightOverride = base.replace(/\bh-10\b|\bh-12\b/, '');

  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={ariaDescribedBy}
        className={[heightOverride, 'py-2.5 resize-y min-h-24 leading-relaxed', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-[#DC2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-[#78716C]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface FieldGroupProps {
  children: ReactNode;
  className?: string;
}

export function FieldGroup({ children, className = '' }: FieldGroupProps) {
  return <div className={['space-y-4', className].join(' ')}>{children}</div>;
}

export default Input;
