// useProjectRole — единый разрез прав для wizard/approvals.
//
// Backend guard'ы (см. backend/src/wizard/wizard.controller.ts) пускают:
//   · chip_admin — глобально на всё
//   · tracker — global ops: все writer-эндпоинты кроме approvals и billing
//   · marketer — на writer-эндпоинты (interview-patterns, values, legend, mission,
//     positioning, message, critique, finalize)
//   · owner_viewer — только на GET-эндпоинты (rows, approvals)
//
// До этого хука frontend не знал о разрезе на уровне проекта и показывал
// owner_viewer'у writer-UI (Textarea + «Извлечь паттерны» кнопка) →
// клик возвращал 403 «role owner_viewer is not in required set». UX-катастрофа
// на первой же стадии. Хук централизует проверку: все Stage*Page / ProjectDetailPage
// должны читать `canWrite` и `isOwnerViewer` отсюда, а не переизобретать логику.

import { useAuthStore } from '../store/auth';
import type { ProjectRole } from '../types/api';

export interface ProjectRoleInfo {
  /** null если пользователь не состоит в проекте (не должно случаться на protected routes). */
  role: 'chip_admin' | 'tracker' | ProjectRole | null;
  /** true для chip_admin, tracker и marketer. Показываем writer-UI. */
  canWrite: boolean;
  /** true только если пользователь — owner_viewer по этому проекту. Показываем read-only баннер. */
  isOwnerViewer: boolean;
  /** true только если marketer по этому проекту (НЕ для chip_admin/tracker — у них своя специфика). */
  isMarketer: boolean;
  /**
   * true для chip_admin ИЛИ tracker — в контексте страницы проекта оба ведут себя
   * как «ops с правом записи» (экспорт, advance-stage, writer-эндпоинты).
   * Methodological-инвариант (approve только owner) проверяется отдельно в
   * ApprovalsPage, там tracker всё равно не пустят.
   */
  isAdmin: boolean;
}

export function useProjectRole(projectId?: string): ProjectRoleInfo {
  const { user } = useAuthStore();

  if (!user) {
    return { role: null, canWrite: false, isOwnerViewer: false, isMarketer: false, isAdmin: false };
  }

  // Глобальный админ бьёт любую project-роль — у него и read, и write везде.
  if (user.globalRole === 'chip_admin') {
    return { role: 'chip_admin', canWrite: true, isOwnerViewer: false, isMarketer: false, isAdmin: true };
  }

  // Трекер — operational global: read+write всех проектов. Не может approve
  // (это enforcing'ся на backend, здесь `isAdmin: true` только про writer-права).
  if (user.globalRole === 'tracker') {
    return { role: 'tracker', canWrite: true, isOwnerViewer: false, isMarketer: false, isAdmin: true };
  }

  if (!projectId) {
    return { role: null, canWrite: false, isOwnerViewer: false, isMarketer: false, isAdmin: false };
  }

  const projectRole = user.projectRoles?.find((r) => r.projectId === projectId)?.role ?? null;

  if (!projectRole) {
    // Пользователь есть, но не в этом проекте. Protected route уже должен был отсечь —
    // но на всякий случай возвращаем безопасный дефолт.
    return { role: null, canWrite: false, isOwnerViewer: false, isMarketer: false, isAdmin: false };
  }

  return {
    role: projectRole,
    canWrite: projectRole === 'marketer',
    isOwnerViewer: projectRole === 'owner_viewer',
    isMarketer: projectRole === 'marketer',
    isAdmin: false,
  };
}
