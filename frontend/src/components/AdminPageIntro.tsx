import type { LucideIcon } from 'lucide-react';
import { Eye, Target, Clock } from 'lucide-react';

// AdminPageIntro — «пояснительная бригада» в шапке каждой /admin/* страницы.
//
// Проблема: admin-страницы раньше здоровались с админом англицизмами —
// «Silent failures», «Wizard drop-off», «BriefSanitizerService», «anthropic_cost_factor».
// Даже Чирков (владелец продукта) сказал «ни хрена не понимаю». Это провал: админ-
// страница без понимания = админ её не открывает = наблюдаемости нет.
//
// Решение: унифицированный intro-блок с тремя слотами:
//   · whatIs       — «Что это» — одной строкой, без терминов.
//   · whyForYou    — «Зачем вам» — какое конкретное решение админ принимает.
//   · whenToOpen   — «Когда открывать» — триггер (утром? раз в квартал? после инцидента?).
//
// Визуальная стилистика — та же что у Card.Header (10×10 indigo-soft bg + иконка 5×5),
// чтобы страницы ощущались единой наблюдательной зоной, а не случайными экранами.

export interface AdminPageIntroProps {
  /** Иконка темы (BarChart3 / Shield / Target / Wallet и т.п.). */
  icon: LucideIcon;
  /** Заголовок страницы — русский, без англицизмов. */
  title: string;
  /** Что это — одной фразой, «человеческим» языком. */
  whatIs: string;
  /** Зачем это лично админу — какое решение здесь принимается. */
  whyForYou: string;
  /** Когда открывать — триггер: утро каждого дня / раз в квартал / после инцидента. */
  whenToOpen: string;
}

export default function AdminPageIntro({
  icon: Icon,
  title,
  whatIs,
  whyForYou,
  whenToOpen,
}: AdminPageIntroProps) {
  return (
    <div className="rounded-2xl border border-[#E7E5E4] bg-white overflow-hidden">
      {/* Head — иконка + title + whatIs в одной строке. Items-center, чтобы иконка
          не уходила в верхний угол при длинном description (Refactoring UI §17). */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#4F46E5]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[#1A1A1A] leading-tight">{title}</h2>
          <p className="text-sm text-[#57534E] mt-1 leading-relaxed">{whatIs}</p>
        </div>
      </div>

      {/* Два слота внизу: «Зачем вам» + «Когда открывать». Горизонтально на md+,
          вертикально на мобиле. Цвет фона — очень светлый warm gray, чтобы блок
          читался как «пояснение», а не как самостоятельная панель действий. */}
      <div className="border-t border-[#F5F5F4] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#F5F5F4] bg-[#FAFAF9]">
        <Slot icon={Target} label="Зачем вам" text={whyForYou} />
        <Slot icon={Clock} label="Когда открывать" text={whenToOpen} />
      </div>
    </div>
  );
}

function Slot({
  icon: Icon,
  label,
  text,
}: {
  icon: LucideIcon;
  label: string;
  text: string;
}) {
  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <Icon className="w-4 h-4 text-[#78716C] mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="uppercase text-[10px] font-semibold text-[#78716C] tracking-[0.08em]">
          {label}
        </p>
        <p className="text-[13px] text-[#44403C] mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// Утилитарный экспорт — иногда странице хочется подсказать «а что это здесь?»
// без дополнительного компонента. Оставим на потом, сейчас не используется.
export const INTRO_EYE_ICON = Eye;
