import { useState } from 'react';
import { MessageSquareWarning, CheckCircle2, RotateCcw } from 'lucide-react';
import Button from './ui/Button';

interface FeedbackFormProps {
  draftId: string;
  rowId: string;
  onSubmit: (payload: { rejected: string; reason: string; reformulate: string }) => Promise<void>;
  // Опциональная кнопка «Принять черновик» — рендерится рядом с «Пере-генерировать»
  // в общем action-row. Раньше Accept жила в отдельной Card внизу, а ниже была дубль-
  // кнопка «Пересгенерировать» — получалось два разных места, где маркетолог должен
  // решить одно и то же. Артём (2026-04-19): «перегенерировать уже лишняя кнопка,
  // а принять можно поставить в карточку про что поправить». Теперь одно место.
  onAccept?: () => void;
  // Текст Accept-кнопки — дефолт покрывает Stage 1/2/3. Можно переопределить на стадии.
  acceptLabel?: string;
  // Статус «уже принято»: если true — скрываем FeedbackForm, рендерим только
  // баннер-подтверждение + кнопка «Вернуть на правки». Это нужно чтобы маркетолог,
  // кликнув назад на уже утверждённую вкладку, видел понятное состояние, а не
  // заново-пустую форму. onAccept управляется родителем как toggle.
  accepted?: boolean;
  onReopen?: () => void;
  // «Вернуть на правки» подпись (опционально; дефолт «Вернуть на правки»).
  reopenLabel?: string;
}

// Форма правок из INSIGHTS B-9 (Горшков):
// «Фидбэк клиента НЕ скармливать агенту напрямую — оборачивать через шаблон правок
// (поля: что отверг / почему / как переформулировать)».
//
// Две ветки рендера:
//  1) accepted=true → зелёный баннер «Утверждено», кнопка «Вернуть на правки» (если onReopen).
//  2) accepted=false → три поля + Accept/Regen buttons внизу одной карточки.
export default function FeedbackForm({
  onSubmit,
  onAccept,
  acceptLabel = 'Принять черновик',
  accepted = false,
  onReopen,
  reopenLabel = 'Вернуть на правки',
}: FeedbackFormProps) {
  const [rejected, setRejected] = useState('');
  const [reason, setReason] = useState('');
  const [reformulate, setReformulate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canRegen =
    rejected.trim().length > 0 && reason.trim().length > 0 && reformulate.trim().length > 0;

  const handleRegen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegen) return;
    setSubmitting(true);
    try {
      await onSubmit({ rejected, reason, reformulate });
      setDone(true);
      setRejected(''); setReason(''); setReformulate('');
      setTimeout(() => setDone(false), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  if (accepted) {
    return (
      <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] flex-shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#14532D]">Черновик утверждён маркетологом</p>
              <p className="text-xs text-[#166534] mt-0.5">
                Зафиксирован. Если нужно внести правки — откатите утверждение и вернитесь к форме.
              </p>
            </div>
          </div>
          {onReopen && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RotateCcw}
              onClick={onReopen}
              type="button"
            >
              {reopenLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleRegen} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-2">
        <MessageSquareWarning className="w-4 h-4 text-[#4F46E5] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-sm">Что поправить в черновике</h4>
          <p className="text-[#6B7280] text-xs mt-1">
            Заполните три поля, нажмите «Пере-генерировать черновик» — Claude учтёт правки.
            Если черновик уже устраивает — сразу «{acceptLabel}».
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">Что отверг</label>
        <textarea
          value={rejected}
          onChange={(e) => setRejected(e.target.value)}
          rows={2}
          placeholder="Например: формулировка ценности «мы семья»"
          className="w-full px-3 py-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">Почему</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Например: клише, банально, не отличает нас от конкурентов"
          className="w-full px-3 py-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">Как переформулировать</label>
        <textarea
          value={reformulate}
          onChange={(e) => setReformulate(e.target.value)}
          rows={2}
          placeholder="Например: формулировка должна описывать конкретное поведение — не «мы», а «врач подходит первым»"
          className="w-full px-3 py-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
        />
      </div>

      {/* Action-row: два пути — «Пере-генерировать» (требует 3 поля) и «Принять» (без полей).
          Accept = primary (позитивный исход, вперёд). Regen = secondary (правки = задержка).
          Раньше в этой форме была только regen-кнопка, а accept жила в отдельной Card ниже —
          плюс третья кнопка-дубль «Пересгенерировать» там же. Один клик — один выбор. */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        {done ? (
          <span className="text-[#22C55E] text-xs">Отправили. Пере-генерируем черновик…</span>
        ) : (
          <span className="text-[#9CA3AF] text-xs">
            {canRegen ? 'Поля заполнены — можно пере-генерировать' : 'Три поля или сразу «Принять»'}
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            iconLeft={RotateCcw}
            type="submit"
            loading={submitting}
            disabled={!canRegen}
          >
            Пере-генерировать черновик
          </Button>
          {onAccept && (
            <Button
              variant="primary"
              size="md"
              iconLeft={CheckCircle2}
              type="button"
              onClick={onAccept}
            >
              {acceptLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
