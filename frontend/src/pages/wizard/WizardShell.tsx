import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { http } from '../../api/http';
import type { Project } from '../../types/api';

interface WizardShellProps {
  stage: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const STAGE_META: Record<number, { short: string; full: string }> = {
  1: { short: 'Портрет клиента', full: 'Стадия 1. Портрет клиента' },
  2: { short: 'Сессия с собственником', full: 'Стадия 2. Сессия с собственником' },
  3: { short: 'Архетип и позиционирование', full: 'Стадия 3. Архетип и позиционирование' },
  4: { short: '4 теста месседжа', full: 'Стадия 4. Четыре теста месседжа' },
};

export default function WizardShell({ stage, title, subtitle, children }: WizardShellProps) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!id) return;
    http.get<Project>(`/projects/${id}`).then((res) => setProject(res.data)).catch(() => {});
    // Событие открытия стадии для wizard-dropoff (C-B-12)
    http.post('/wizard/events', { projectId: id, stage, event: 'stage_opened' }).catch(() => {});
  }, [id, stage]);

  // Прогресс: сколько % от методологии пройдено (завершённые + половина текущей).
  const progressPct = project
    ? ((Math.min(project.currentStage - 1, stage - 1) + 0.5) / 4) * 100
    : ((stage - 0.5) / 4) * 100;

  return (
    <div className="space-y-6 fade-in">
      {/* Sticky top: 2px indigo progress bar (Stripe pattern) */}
      <div className="sticky top-0 z-30 -mx-6 -mt-4 px-6 pt-4 pb-3 bg-[#FAFAF9]/90 backdrop-blur-sm">
        <div className="h-0.5 w-full bg-[#E7E5E4] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[#4F46E5] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={`/projects/${id}`}
            className="text-[#78716C] hover:text-[#1A1A1A] transition-colors flex items-center gap-1 text-sm rounded-md px-1 -mx-1"
          >
            <ArrowLeft className="w-4 h-4" /> К проекту
          </Link>
          {project && (
            <>
              <span className="text-[#D6D3D1]" aria-hidden>·</span>
              <span className="text-[#44403C] text-sm font-medium truncate max-w-[240px]">{project.name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          {[1, 2, 3, 4].map((s) => {
            const isCurrent = s === stage;
            // Finalized-проект: ВСЕ 4 стадии done (currentStage в БД остаётся 4,
            // и без этого special-case stage 4 не определился бы как done — 4>4=false).
            // Это нужно чтобы админ/собственник мог ходить по стадиям завершённого
            // проекта и смотреть «как всё прошло» — ключевое требование usability.
            const isDone = project
              ? project.currentStage > s || (project.status === 'finalized' && !isCurrent)
              : false;
            // Максимальная доступная стадия: наивысшая из «до чего дошёл пользователь»
            // и «на какой странице сейчас» (стадию можно посетить напрямую по URL
            // до того как backend проинкрементирует currentStage).
            // Требование Артёма (2026-04-19): «я же маркетолог, я хочу просто нажать
            // на стадию 1 которая идёт вверху как навигация» — возвращение назад
            // должно работать ВСЕГДА, с любой стадии на любую предыдущую.
            const maxAccessibleStage = project
              ? project.status === 'finalized'
                ? 4
                : Math.max(project.currentStage, stage)
              : stage;
            const isAccessible = !isCurrent && s <= maxAccessibleStage;
            const isLocked = !isCurrent && !isAccessible;
            // Pill-chip из handoff: active=indigo solid, done=white+border+✓, locked=bg-FAFAF9.
            // Accessible-но-не-done (например пришёл на stage 2 пока currentStage=1,
            // stage 1 доступна назад): тот же white-стиль с hover — визуально маркер «кликабельно».
            const cls = isCurrent
              ? 'bg-[#4F46E5] text-white border-transparent'
              : isAccessible
              ? 'bg-white text-[#1A1A1A] border-[#E7E5E4] hover:border-[#D6D3D1] hover:bg-[#FAFAF9] cursor-pointer'
              : 'bg-[#FAFAF9] text-[#A8A29E] border-transparent cursor-not-allowed';
            const commonCls = [
              'h-8 pl-2.5 pr-3 inline-flex items-center gap-1.5 rounded-[10px]',
              'text-[13px] font-medium border transition-colors duration-200',
              cls,
            ].join(' ');
            const content = (
              <>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" aria-hidden />}
                {!isDone && isCurrent && <Clock className="w-3.5 h-3.5" aria-hidden />}
                {isLocked && <Lock className="w-3.5 h-3.5" aria-hidden />}
                <span>Стадия {s}. {STAGE_META[s].short}</span>
              </>
            );
            // Accessible (не-current) — Link, клик → навигация. Current — div
            // (текущая страница, Link на неё бессмыслен). Locked — div (запрещено).
            if (isAccessible) {
              return (
                <Link
                  key={s}
                  to={`/projects/${id}/stage-${s}`}
                  className={commonCls}
                  title={STAGE_META[s].full}
                >
                  {content}
                </Link>
              );
            }
            return (
              <div key={s} className={commonCls} title={STAGE_META[s].full}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* Заголовок стадии */}
      <div>
        <p className="uppercase-mono">
          Стадия {stage} из 4 · {STAGE_META[stage].short}
        </p>
        <h2 className="font-display text-[32px] leading-tight text-[#1A1A1A] tracking-[-0.02em] mt-1.5">
          {title}
        </h2>
        <p className="text-[#78716C] text-sm mt-2 max-w-3xl leading-relaxed">{subtitle}</p>
      </div>

      {children}
    </div>
  );
}
