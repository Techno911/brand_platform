import { Sparkles, AlertCircle, AlertTriangle } from 'lucide-react';

export interface SufflerHint {
  id: string;
  title: string;
  body: string;
  /**
   * Опциональный нумерованный список под body. Используется когда подсказка —
   * это чек-лист или последовательность (например, вопросы для CustDev-интервью
   * на Стадии 1). Рендерится как `<ol>` с монотипным счётчиком в стиле
   * login-hero taglines, чтобы визуально считывался как «шаги».
   */
  items?: string[];
  severity?: 'info' | 'warning' | 'danger';
}

interface SufflerPanelProps {
  hints: SufflerHint[];
  loading?: boolean;
  title?: string;
}

// UX-суфлёр: правая панель с подсказками по текущему полю (C-15 INSIGHTS).
// Появляется с задержкой через CSS-анимацию suffler-enter (index.css).
export default function SufflerPanel({ hints, loading = false, title = 'Подсказки по текущему шагу' }: SufflerPanelProps) {
  return (
    <aside className="flex flex-col gap-3 sticky top-4 suffler-enter min-w-0">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-[#4F46E5] flex-shrink-0" />
        <h4 className="uppercase-mono text-[#1A1A1A]">{title}</h4>
      </div>
      {loading && <p className="text-[#A8A29E] text-xs px-1">Подбираем подсказки…</p>}
      {!loading && hints.length === 0 && (
        <p className="text-[#A8A29E] text-xs px-1">Здесь появятся подсказки, когда вы начнёте заполнять поле.</p>
      )}
      <ul className="space-y-3">
        {hints.map((h) => (
          <li key={h.id} className={hintClasses(h.severity)}>
            <div className="flex items-center gap-2">
              {h.severity === 'warning' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {h.severity === 'danger' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {(!h.severity || h.severity === 'info') && <Sparkles className="w-4 h-4 flex-shrink-0 text-[#4F46E5]" />}
              <p className={`text-[13px] font-semibold leading-snug ${headingColor(h.severity)}`}>
                {h.title}
              </p>
            </div>
            <p className="text-[13px] text-[#44403C] leading-relaxed mt-1.5">{h.body}</p>
            {h.items && h.items.length > 0 && (
              <ol className="mt-2.5 space-y-2">
                {h.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="font-mono flex-shrink-0 w-5 h-5 rounded-full
                        bg-[rgba(79,70,229,0.08)] text-[#4F46E5]
                        text-[10px] font-semibold flex items-center justify-center tabular-nums mt-[1px]"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[13px] text-[#44403C] leading-[1.45] flex-1">{it}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function hintClasses(severity?: 'info' | 'warning' | 'danger'): string {
  const base = 'p-3.5 rounded-2xl border';
  switch (severity) {
    case 'warning': return `${base} bg-[#FEFCE8] border-[#FDE68A]`;
    case 'danger': return `${base} bg-[#FEF2F2] border-[#FCA5A5]`;
    default: return `${base} bg-white border-[#E7E5E4]`;
  }
}

function headingColor(severity?: 'info' | 'warning' | 'danger'): string {
  switch (severity) {
    case 'warning': return 'text-[#92400E]';
    case 'danger': return 'text-[#991B1B]';
    default: return 'text-[#1A1A1A]';
  }
}
