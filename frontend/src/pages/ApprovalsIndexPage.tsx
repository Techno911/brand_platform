import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import { http } from '../api/http';
import type { Project } from '../types/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

// Индекс утверждений — все проекты пользователя, не только stage≥2.
// Решение: если фильтровать `currentStage >= 2`, то маркетолог с единственным проектом на
// Стадии 1 видит глухую стену "Пока нечего подписывать" без контекста. Честнее — показать
// все проекты и на card'е явно сказать в каком состоянии approvals.
// Клик ведёт в /projects/:id/approvals; pending-count не считаем (N+1 на MVP избыточен).
export default function ApprovalsIndexPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<Project[]>('/projects');
        setProjects(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero-карточка: header-only (нет Body под ним) — Card.Header по умолчанию pb-0, потому что
          предполагается Body снизу. Здесь Body нет, добавляем pb-5 чтобы симметрия сверху/снизу.
          items-center на внутреннем flex — иконка визуально выравнивается по центру блока Title+Description. */}
      <Card variant="elevated">
        <Card.Header className="pb-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#4F46E5]" aria-hidden />
            </div>
            <div className="min-w-0">
              <Card.Title>Утверждения</Card.Title>
              <Card.Description>
                Проекты, в которых ожидаются или уже есть подписи собственника. Подписанная
                формулировка становится финальной — отменить нельзя, только выпустить новую версию.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
      </Card>

      {loading ? (
        <Card>
          <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Пока нечего подписывать"
            description="Артефакты появятся здесь после того, как маркетолог закроет Стадию 2 и отправит на одобрение."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}/approvals`}
              className="group"
              aria-label={`Утверждения проекта ${p.name}`}
            >
              <Card className="h-full transition-colors duration-200 group-hover:border-[#D6D3D1]">
                <Card.Body>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="uppercase-mono text-[#78716C]">Стадия {p.currentStage} из 4</p>
                      <h3 className="font-medium text-[15px] text-[#1A1A1A] mt-1 truncate">{p.name}</h3>
                      {p.client?.name && (
                        <p className="text-[13px] text-[#78716C] mt-0.5 truncate">{p.client.name}</p>
                      )}
                    </div>
                    <Badge
                      className="whitespace-nowrap flex-shrink-0"
                      variant="soft"
                      color={
                        p.currentStage >= 3 ? 'primary'
                        : p.currentStage === 2 ? 'warning'
                        : 'neutral'
                      }
                    >
                      {p.currentStage >= 3
                        ? 'Есть артефакты'
                        : p.currentStage === 2
                        ? 'Готовится'
                        : 'Ранняя стадия'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-end text-[13px] text-[#4F46E5]
                    group-hover:text-[#3730A3] transition-colors">
                    <span>К утверждениям</span>
                    <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
                  </div>
                </Card.Body>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
