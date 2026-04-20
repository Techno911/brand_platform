import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';

// ReadOnlyBanner — сверху wizard-стадий для owner_viewer'а.
// Показываем ДО любого контента, чтобы собственник сразу понял: «я смотрю,
// а не правлю». Без этого баннера он тыкает в Textarea и в «Сгенерировать»,
// получает 403 от backend — и теряет доверие к платформе на первой же стадии.

export interface ReadOnlyBannerProps {
  /** Заголовок баннера — одной строкой. */
  title?: string;
  /** Тело — одно-два предложения объяснения. Может включать JSX (ссылки/Link). */
  children: ReactNode;
}

export default function ReadOnlyBanner({
  title = 'Режим просмотра',
  children,
}: ReadOnlyBannerProps) {
  return (
    <div
      role="status"
      className="rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] p-4 flex gap-3 text-sm
        text-[#3730A3] leading-relaxed"
    >
      <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-1 min-w-0">
        <p className="font-semibold text-[#312E81]">{title}</p>
        <p className="text-[#4338CA]">{children}</p>
      </div>
    </div>
  );
}
