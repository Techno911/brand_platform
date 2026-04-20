import { Clock } from 'lucide-react';
import type { HTMLAttributes } from 'react';

// DeadlineBadge — показывает статус дедлайна относительно текущего момента.
// Портирован из RO SaaS (/Users/techno/Desktop/ЧиП/frontend/src/components/ui/DeadlineBadge.tsx).
// Палитра сохранена (семантические цвета: красный=просрочено/сегодня, жёлтый=скоро, neutral=норма) —
// эти цвета уже в BP palette как danger/warning soft Badge tones.
// Готов для wizard stage cards и approval due-dates.

export interface DeadlineBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** ISO date string — например, `project.dueAt` */
  deadline: string;
}

export default function DeadlineBadge({
  deadline,
  className = '',
  ...rest
}: DeadlineBadgeProps) {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  let colorClass: string;

  if (diffMs < 0) {
    label = 'Просрочено';
    colorClass = 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]';
  } else if (diffDays <= 1) {
    label = 'Сегодня';
    colorClass = 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]';
  } else if (diffDays <= 3) {
    label = `${diffDays} ${pluralDays(diffDays)}`;
    colorClass = 'bg-[#FEFCE8] text-[#A16207] border-[#FDE047]';
  } else {
    const formatted = deadlineDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
    label = formatted;
    colorClass = 'bg-[#F5F5F4] text-[#78716C] border-[#E7E5E4]';
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border leading-5',
        colorClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Clock className="w-3 h-3" aria-hidden />
      {label}
    </span>
  );
}

// Русский плюрализатор дней: 1 день / 2 дня / 5 дней.
function pluralDays(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
