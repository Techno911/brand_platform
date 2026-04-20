import type { ReactNode } from 'react';

export interface DiffBlockProps {
  /** Исходный (до правки) текст */
  before: string;
  /** Новый (после правки) текст */
  after: string;
  /** Метка сверху (например "Message #2 / Фраза") */
  label?: string;
  /** Режим: split (две колонки) или unified (под-друг-другом) */
  view?: 'split' | 'unified';
  /** Подпись автора правки */
  author?: string;
  className?: string;
  children?: ReactNode;
}

function EmptyText() {
  return <span className="italic text-[#A8A29E]">(пусто)</span>;
}

export default function DiffBlock({
  before,
  after,
  label,
  view = 'split',
  author,
  className = '',
}: DiffBlockProps) {
  const unchanged = before === after;

  return (
    <div
      className={['rounded-2xl border border-[#E7E5E4] overflow-hidden bg-white', className]
        .filter(Boolean)
        .join(' ')}
    >
      {(label || author) && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#FAFAF9] border-b border-[#E7E5E4]">
          {label && (
            <span className="uppercase-mono text-[#44403C]">{label}</span>
          )}
          {author && <span className="text-xs text-[#78716C] font-mono">{author}</span>}
        </div>
      )}
      {unchanged ? (
        <div className="p-4 text-sm text-[#44403C] leading-relaxed">{before || <EmptyText />}</div>
      ) : view === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E7E5E4]">
          <div className="p-4 bg-[#FAFAF9]">
            <div className="text-xs font-semibold text-[#78716C] uppercase mb-2">Было</div>
            <p className="text-sm text-[#78716C] line-through leading-relaxed break-words">
              {before || <EmptyText />}
            </p>
          </div>
          <div className="p-4 bg-[#EEF2FF] border-l-0 md:border-l-4 md:border-l-[#4F46E5]">
            <div className="text-xs font-semibold text-[#3730A3] uppercase mb-2">Стало</div>
            <p className="text-sm text-[#1A1A1A] font-medium leading-relaxed break-words">
              {after || <EmptyText />}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="p-4 bg-[#FAFAF9]">
            <p className="text-sm text-[#78716C] line-through leading-relaxed break-words">
              {before || <EmptyText />}
            </p>
          </div>
          <div className="p-4 bg-[#EEF2FF] border-l-4 border-[#4F46E5]">
            <p className="text-sm text-[#1A1A1A] font-medium leading-relaxed break-words">
              {after || <EmptyText />}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
