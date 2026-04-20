import Badge from './Badge';
import type { BadgeProps } from './Badge';
import type { ProjectStatus } from '../../types/api';

// ProjectStatusBadge — типобезопасный wrapper вокруг Badge для статусов проектов.
// Маппинг скопирован из ProjectsPage.tsx STATUS_META и нормализован. Не ломает существующий
// inline-mapping в ProjectsPage — просто даёт reusable альтернативу для Dashboard / ApprovalsPage.
// Паттерн (typed status → <Badge variant color>) взят из RO SaaS status-badge.tsx.

const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: NonNullable<BadgeProps['color']> }
> = {
  draft: { label: 'Черновик', color: 'neutral' },
  stage_1: { label: 'Стадия 1', color: 'primary' },
  stage_2: { label: 'Стадия 2', color: 'primary' },
  stage_3: { label: 'Стадия 3', color: 'primary' },
  stage_4: { label: 'Стадия 4', color: 'primary' },
  finalized: { label: 'Финал', color: 'success' },
  archived: { label: 'Архив', color: 'neutral' },
  abandoned: { label: 'Остановлен', color: 'danger' },
};

export interface ProjectStatusBadgeProps
  extends Omit<BadgeProps, 'color' | 'children' | 'variant'> {
  status: ProjectStatus;
  variant?: BadgeProps['variant'];
}

export default function ProjectStatusBadge({
  status,
  variant = 'soft',
  ...rest
}: ProjectStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <Badge variant={variant} color={meta.color} {...rest}>
      {meta.label}
    </Badge>
  );
}
