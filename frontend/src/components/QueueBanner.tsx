import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { http } from '../api/http';

/**
 * QueueBanner — показывает глобальную очередь LLM-вызовов над контентом.
 *
 * Поведение:
 *   - Скрыт, если depth=0. Появляется только когда реально стоят в очереди.
 *   - Опрос раз в 5 секунд (невидимо, только если страница активна).
 *   - Текст на русском, без JSON/technical detail — маркетолог не должен
 *     видеть «vendor=anthropic rpm=42/1500». Для chip_admin есть отдельный
 *     dashboard `/admin/queue` (TBD).
 *
 * Источник требования: ВВ Вани «если у тебя садится работать несколько
 * человек — должны видеть, сколько вперёди». Нашей реализации достаточно
 * одной цифры: сколько запросов впереди текущего. UX-чип Хегая «сэкономил N
 * часов» остаётся отдельным компонентом TimeSavedChip.
 */
export default function QueueBanner() {
  const [depth, setDepth] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const res = await http.get<{ depth: number }>('/ai/queue/depth');
        if (!cancelled) setDepth(Number(res.data?.depth ?? 0));
      } catch {
        // Молча скрываем баннер при ошибке — не пугаем маркетолога.
        if (!cancelled) setDepth(0);
      }
    };

    // Polling только когда вкладка активна — экономим запросы.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tick();
        if (!timer) timer = setInterval(tick, 5000);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (depth <= 0) return null;

  const text =
    depth === 1
      ? 'Один запрос к ассистенту обрабатывается прямо сейчас. Ваш следующий — в очереди.'
      : `Сейчас в очереди ассистента ${depth} запросов. Черновик появится, как только ваш дойдёт до обработки.`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-6 mt-2 mb-4 rounded-2xl border border-[#4F46E5]/30 bg-[#EEF2FF] px-4 py-3 flex items-start gap-3"
    >
      <Clock className="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-[2px]" />
      <div className="text-sm text-[#1E1B4B] leading-relaxed">{text}</div>
    </div>
  );
}
