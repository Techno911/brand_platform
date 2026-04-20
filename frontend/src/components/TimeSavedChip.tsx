import { Clock, Database } from 'lucide-react';

interface TimeSavedChipProps {
  /**
   * Реальная длительность работы LLM-вендора в секундах.
   * Для cache hit это длительность ПРОШЛОГО (живого) вызова, который
   * сгенерировал этот контент — НЕ текущий HTTP round-trip.
   * Берётся из `ai.latencyMs / 1000` (backend возвращает `prompt_run.provider_latency_ms`).
   */
  generationSeconds: number;
  /**
   * Сколько минут ручной работы маркетолога экономит этот AI-черновик.
   * Эвристика per-stage (Stage 1 = 180 мин, Stage 2 values ≈ 120 мин, и т.д.).
   */
  manualMinutesEquivalent: number;
  /**
   * True, если backend вернул закэшированную строку из `prompt_runs` без нового
   * вызова к LLM-вендору. В этом режиме рендерится отдельный жёлтый чип с датой
   * оригинального вызова — честно сообщаем что «сейчас» AI не работал.
   */
  cacheHit?: boolean;
  /**
   * ISO-8601 момент, когда LLM фактически сгенерировал этот контент.
   * Используется только в ветке `cacheHit=true` для формулировки «посчитано {давно} назад».
   */
  generatedAt?: string;
}

// Человеческое «давно назад» для русского языка без i18n-библиотеки.
// Правила: <60с = «только что», <60м = «N мин назад», <24ч = «N ч назад»,
// иначе — дата DD.MM.YYYY. Никаких Intl.RelativeTimeFormat — сознательно,
// чтобы формулировка была под контролем методологии (а не браузерной локали).
function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'ранее';
  const deltaMs = Date.now() - then;
  if (deltaMs < 60_000) return 'только что';
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн назад`;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Чип «Claude сделал черновик за 45 сек — сэкономил N часов» (B-inner, Хегай).
// Закрепляет привычку принимать/править AI-черновики.
//
// Два режима:
//  · fresh (cacheHit=false): зелёный чип с реальной длительностью вызова к вендору.
//  · cached (cacheHit=true): жёлтый чип «Результат из кэша от {ago}. Повторный вызов
//    не потребовался — инпут не менялся». Это ВАЖНО методологически: если рендерить
//    в обоих режимах «Claude за 1 сек», собственник на демо думает что AI магически
//    мгновенный, а маркетолог — что Claude работает молниеносно и не осознаёт что
//    страница стабильна между перезагрузками из-за кэша. Честная пометка снимает
//    оба искажения.
export default function TimeSavedChip({
  generationSeconds,
  manualMinutesEquivalent,
  cacheHit = false,
  generatedAt,
}: TimeSavedChipProps) {
  const savedHours = (manualMinutesEquivalent / 60).toFixed(1);

  if (cacheHit) {
    const ago = generatedAt ? formatAgo(generatedAt) : 'ранее';
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFFBEB] border border-[#FCD34D] rounded-full text-xs"
        title="Backend нашёл в БД строку с тем же inputHash и вернул её без нового звонка в LLM. Это штатное кэширование: экономит деньги, rate-limit и время. Сам черновик — настоящий результат настоящего вызова, просто из прошлого."
      >
        <Database className="w-3.5 h-3.5 text-[#92400E]" />
        <span className="text-[#92400E] font-medium">
          Результат из кэша ({ago}) — инпут не менялся, повторный вызов не нужен
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] border border-green-200 rounded-full text-xs">
      <Clock className="w-3.5 h-3.5 text-[#22C55E]" />
      <span className="text-[#22C55E] font-medium">
        Claude сделал черновик за {Math.max(1, Math.round(generationSeconds))} сек — сэкономил {savedHours} ч
      </span>
    </div>
  );
}
