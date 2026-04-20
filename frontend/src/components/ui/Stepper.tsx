import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';

export type StepStatus = 'completed' | 'current' | 'locked' | 'pending';

export interface StepperItem {
  index: number;
  label: string;
  hint?: string;
  status: StepStatus;
}

export interface StepperProps {
  steps: StepperItem[];
  onSelect?: (index: number) => void;
  className?: string;
}

function StepCircle({ step }: { step: StepperItem }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2';

  if (step.status === 'completed') {
    return (
      <div className={`${base} bg-[#4F46E5] border-[#4F46E5] text-white`} aria-hidden>
        <Check className="w-4 h-4" />
      </div>
    );
  }
  if (step.status === 'current') {
    return (
      <div className={`${base} bg-white border-[#4F46E5] text-[#3730A3] font-mono`} aria-hidden>
        {step.index}
      </div>
    );
  }
  if (step.status === 'locked') {
    return (
      <div className={`${base} bg-[#F5F5F4] border-[#E7E5E4] text-[#A8A29E]`} aria-hidden>
        <Lock className="w-3.5 h-3.5" />
      </div>
    );
  }
  return (
    <div className={`${base} bg-white border-[#D6D3D1] text-[#78716C] font-mono`} aria-hidden>
      {step.index}
    </div>
  );
}

export default function Stepper({ steps, onSelect, className = '' }: StepperProps): ReactNode {
  const current = steps.find((s) => s.status === 'current');
  return (
    <nav
      aria-label="Этапы wizard"
      role="progressbar"
      aria-valuenow={current?.index ?? 0}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      className={['flex flex-col gap-0', className].filter(Boolean).join(' ')}
    >
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const clickable = onSelect && step.status !== 'locked';
        const rowContent = (
          <div className="flex items-start gap-3 flex-1 py-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <StepCircle step={step} />
              {!isLast && (
                <div
                  className={
                    'w-0.5 flex-1 mt-1 mb-1 min-h-8 ' +
                    (step.status === 'completed' ? 'bg-[#4F46E5]' : 'bg-[#E7E5E4]')
                  }
                  aria-hidden
                />
              )}
            </div>
            <div className="pt-1 flex-1 min-w-0">
              <p
                className={
                  'text-sm font-semibold leading-snug ' +
                  (step.status === 'locked'
                    ? 'text-[#A8A29E]'
                    : step.status === 'current'
                    ? 'text-[#1A1A1A]'
                    : 'text-[#44403C]')
                }
              >
                Стадия {step.index}. {step.label}
              </p>
              {step.hint && (
                <p className="text-xs text-[#78716C] mt-0.5 leading-snug">{step.hint}</p>
              )}
            </div>
          </div>
        );

        return clickable ? (
          <button
            type="button"
            key={step.index}
            onClick={() => onSelect?.(step.index)}
            className="text-left rounded-lg px-2 hover:bg-[#F5F5F4] transition-colors"
          >
            {rowContent}
          </button>
        ) : (
          <div key={step.index} className="px-2">
            {rowContent}
          </div>
        );
      })}
    </nav>
  );
}
