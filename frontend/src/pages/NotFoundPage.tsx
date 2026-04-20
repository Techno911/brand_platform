import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';

/**
 * 404 — неизвестный маршрут. Раньше App.tsx молча редиректил в /dashboard,
 * из-за чего пользователь не понимал, попал ли он по ошибке или страница
 * просто пустая. Теперь показываем явный 404 + кнопки назад/на главную.
 */
export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-[520px] w-full text-center">
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#A8A29E] mb-4">
          Страница не найдена
        </p>

        <h1 className="font-display text-[72px] leading-none tracking-[-0.02em] text-[#1A1A1A] mb-4">
          404
        </h1>

        <p className="text-[#57534E] text-[15px] leading-relaxed mb-2">
          По адресу <code className="font-mono text-[13px] text-[#1A1A1A] bg-[#F5F5F4] px-1.5 py-0.5 rounded">{location.pathname}</code> ничего нет.
        </p>
        <p className="text-[#78716C] text-sm leading-relaxed mb-8">
          Возможно, проект был удалён, или ссылку скопировали с ошибкой. Вернитесь на главную или к списку проектов.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.history.back()}
            data-testid="notfound-back"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Назад
          </Button>

          <Link to="/dashboard">
            <Button variant="primary" size="md" data-testid="notfound-home">
              <Home className="w-4 h-4" aria-hidden />
              На главную
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
