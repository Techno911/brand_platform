import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, LayoutDashboard, FolderKanban, CheckCircle2, AlertTriangle, Users, Wallet,
  BarChart3, TrendingDown, Target, Shield, BellOff, Menu,
} from 'lucide-react';
import Sidebar, { type NavItem } from './Sidebar';
import QueueBanner from './QueueBanner';
import Breadcrumbs from './ui/Breadcrumbs';
import { useAuthStore } from '../store/auth';
import { http } from '../api/http';

const SIDEBAR_STORAGE_KEY = 'bp.sidebar.open';
const MOBILE_BREAKPOINT = 768;

/** Matches Tailwind `md:`. true если viewport < 768px. */
function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Ставим актуальное значение после mount (SSR-safe fallback).
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function pageTitleFromPath(pathname: string, isOwner: boolean): string {
  if (pathname.startsWith('/dashboard')) return 'Главная';
  if (pathname.match(/\/projects\/[^/]+\/stage-1/)) return 'Стадия 1. Портрет клиента';
  if (pathname.match(/\/projects\/[^/]+\/stage-2/)) return 'Стадия 2. Сессия с собственником';
  if (pathname.match(/\/projects\/[^/]+\/stage-3/)) return 'Стадия 3. Архетип и позиционирование';
  if (pathname.match(/\/projects\/[^/]+\/stage-4/)) return 'Стадия 4. Четыре теста месседжа';
  if (pathname.match(/\/projects\/[^/]+\/approvals/)) return 'Утверждения собственника';
  if (pathname.match(/\/projects\/[^/]+$/)) return isOwner ? 'Мой бренд' : 'Проект';
  if (pathname.startsWith('/projects')) return isOwner ? 'Мои бренды' : 'Проекты';
  if (pathname === '/approvals') return 'Утверждения';
  if (pathname.startsWith('/admin/silent-failures')) return 'Сбои AI-вызовов';
  if (pathname.startsWith('/admin/billing')) return 'Цены и тарифы';
  if (pathname.startsWith('/admin/marketer-quality')) return 'Качество маркетологов';
  if (pathname.startsWith('/admin/wizard-dropoff')) return 'Где застревают маркетологи';
  if (pathname.startsWith('/admin/golden-set')) return 'Эталоны';
  if (pathname.startsWith('/admin/security')) return 'Безопасность';
  if (pathname.startsWith('/admin/users')) return 'Клиенты и команда';
  return 'Бренд-платформа';
}

// Хлебные крошки для внутренних страниц. На top-level ('/dashboard', '/projects', '/admin/*')
// возвращаем null — достаточно заголовка в header.
function useBreadcrumbItems(pathname: string, isOwner: boolean): { label: string; to?: string }[] | null {
  // Проект детальная или стадия.
  const projectMatch = pathname.match(/^\/projects\/([^/]+)(\/(stage-[1-4]|approvals))?/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const sub = projectMatch[3];
    const items: { label: string; to?: string }[] = [
      { label: isOwner ? 'Мои бренды' : 'Проекты', to: '/projects' },
      { label: isOwner ? 'Мой бренд' : 'Проект', to: sub ? `/projects/${projectId}` : undefined },
    ];
    if (sub) {
      const subLabel = (() => {
        if (sub === 'stage-1') return 'Стадия 1';
        if (sub === 'stage-2') return 'Стадия 2';
        if (sub === 'stage-3') return 'Стадия 3';
        if (sub === 'stage-4') return 'Стадия 4';
        if (sub === 'approvals') return 'Утверждения';
        return sub;
      })();
      items.push({ label: subLabel });
    }
    return items;
  }
  return null;
}

export default function Layout() {
  // Collapse state живёт в localStorage, чтобы предпочтение пользователя сохранялось между сессиями.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      // private mode — игнорируем
    }
  }, [sidebarOpen]);

  // Mobile drawer state — отдельно от desktop sidebarOpen, чтобы переходы работали
  // независимо и чтобы drawer автоматически закрывался при навигации.
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, clear } = useAuthStore();

  // Закрываем mobile drawer при каждой смене маршрута (нужно для ссылок из других
  // мест — не только из NavGroup). Не мешает desktop (там mobileMenuOpen всегда false).
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Esc закрывает mobile drawer.
  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isMobile, mobileMenuOpen]);

  const navItems: NavItem[] = useMemo(() => {
    const base: NavItem[] = [
      { path: '/dashboard', label: 'Главная', icon: LayoutDashboard, group: 'main' },
      { path: '/projects', label: 'Проекты', icon: FolderKanban, group: 'main' },
    ];
    if (user?.globalRole === 'chip_admin') {
      return [
        ...base,
        { path: '/approvals', label: 'Утверждения', icon: CheckCircle2, group: 'main' },
        { path: '/admin/silent-failures', label: 'Сбои AI', icon: AlertTriangle, group: 'admin' },
        { path: '/admin/marketer-quality', label: 'Маркетологи', icon: BarChart3, group: 'admin' },
        { path: '/admin/wizard-dropoff', label: 'Застревания', icon: TrendingDown, group: 'admin' },
        { path: '/admin/golden-set', label: 'Эталоны', icon: Target, group: 'admin' },
        { path: '/admin/security', label: 'Безопасность', icon: Shield, group: 'admin' },
        { path: '/admin/billing', label: 'Цены и тарифы', icon: Wallet, group: 'admin' },
        { path: '/admin/users', label: 'Клиенты и команда', icon: Users, group: 'admin' },
      ];
    }
    // tracker видит админку кроме биллинга (маржа/тарифы скрыты намеренно,
    // см. docs/RBAC.md `tracker` секцию).
    if (user?.globalRole === 'tracker') {
      return [
        ...base,
        { path: '/approvals', label: 'Утверждения', icon: CheckCircle2, group: 'main' },
        { path: '/admin/silent-failures', label: 'Сбои AI', icon: AlertTriangle, group: 'admin' },
        { path: '/admin/marketer-quality', label: 'Маркетологи', icon: BarChart3, group: 'admin' },
        { path: '/admin/wizard-dropoff', label: 'Застревания', icon: TrendingDown, group: 'admin' },
        { path: '/admin/golden-set', label: 'Эталоны', icon: Target, group: 'admin' },
        { path: '/admin/security', label: 'Безопасность', icon: Shield, group: 'admin' },
        { path: '/admin/users', label: 'Клиенты и команда', icon: Users, group: 'admin' },
      ];
    }
    if (user?.projectRoles?.some((r) => r.role === 'owner_viewer')) {
      return [
        { path: '/dashboard', label: 'Главная', icon: LayoutDashboard, group: 'main' },
        { path: '/projects', label: 'Мои бренды', icon: FolderKanban, group: 'main' },
        { path: '/approvals', label: 'Утверждения', icon: CheckCircle2, group: 'main' },
      ];
    }
    return [
      ...base,
      { path: '/approvals', label: 'Утверждения', icon: CheckCircle2, group: 'main' },
    ];
  }, [user]);

  const userName = user?.fullName ?? '—';
  const roleLabel = (() => {
    if (user?.globalRole === 'chip_admin') return 'Чирков и Партнёры · администратор';
    if (user?.globalRole === 'tracker') return 'Чирков и Партнёры · трекер';
    const primary = user?.projectRoles?.find((r) => r.isPrimary) ?? user?.projectRoles?.[0];
    switch (primary?.role) {
      case 'marketer': return 'Маркетолог клиента';
      case 'owner_viewer': return 'Собственник';
      default: return 'Пользователь';
    }
  })();
  const handleLogout = async () => {
    try {
      await http.post('/auth/logout', {});
    } catch {
      // ignore network error, всё равно очищаем
    }
    clear();
    navigate('/login', { replace: true });
  };

  // Owner-режим заголовков: пользователь — собственник хотя бы одного проекта и при этом НЕ маркетолог.
  // Так «Мои бренды» не показывается админу/трекеру, который по ошибке включил себе owner_viewer для теста.
  const isOwnerOnly =
    user?.globalRole !== 'chip_admin' &&
    user?.globalRole !== 'tracker' &&
    !user?.projectRoles?.some((r) => r.role === 'marketer') &&
    !!user?.projectRoles?.some((r) => r.role === 'owner_viewer');
  const breadcrumbs = useBreadcrumbItems(location.pathname, isOwnerOnly);
  const title = pageTitleFromPath(location.pathname, isOwnerOnly);

  // Подтягиваем имя текущего проекта для sidebar-subtitle.
  // Логика: если URL = /projects/:id/* → достаём id → единожды фетчим /projects/:id → подставляем name.
  // На других страницах subtitle пустой, Sidebar сам падает на default ("Чирков & Партнёры").
  // Кэш в stateState, не в zustand: скоуп нужен только для шапки sidebar'а.
  const projectIdMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectIdMatch?.[1] ?? null;
  const [projectNameCache, setProjectNameCache] = useState<Record<string, string>>({});
  const workspaceSubtitle = currentProjectId ? projectNameCache[currentProjectId] : undefined;
  useEffect(() => {
    if (!currentProjectId || projectNameCache[currentProjectId]) return;
    let cancelled = false;
    http
      .get<{ name: string }>(`/projects/${currentProjectId}`)
      .then((r) => {
        if (!cancelled && r.data?.name) {
          setProjectNameCache((prev) => ({ ...prev, [currentProjectId]: r.data.name }));
        }
      })
      .catch(() => {
        // 403 / 404 — тихо игнорируем, sidebar покажет default subtitle.
      });
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, projectNameCache]);

  // Notifications popover — система нотификаций появится пост-MVP (Telegram chip_admin).
  // Пока honest placeholder: кнопка кликается, показывает пустое состояние.
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setBellOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [bellOpen]);

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <Sidebar
        navItems={navItems}
        userName={userName}
        userRole={roleLabel}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        workspaceSubtitle={workspaceSubtitle}
      />

      {/* Backdrop — только мобильный drawer открыт */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      <main
        className="transition-[margin-left] duration-300 ease-out min-h-screen"
        style={{ marginLeft: isMobile ? 0 : (sidebarOpen ? 240 : 64) }}
      >
        <header className="min-h-[72px] px-4 md:px-8 py-4 border-b border-[#E7E5E4] bg-[#FAFAF9]">
          <div className="max-w-7xl mx-auto">
            {breadcrumbs && (
              <div className="mb-2">
                <Breadcrumbs>
                  {breadcrumbs.map((b, i) =>
                    b.to ? (
                      <Breadcrumbs.Item key={i} href={b.to}>{b.label}</Breadcrumbs.Item>
                    ) : (
                      <Breadcrumbs.Current key={i}>{b.label}</Breadcrumbs.Current>
                    )
                  )}
                </Breadcrumbs>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {/* Hamburger — только на мобиле. Десктоп не показывает, там есть Sidebar collapse. */}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-[#E7E5E4]
                    text-[#78716C] hover:text-[#1A1A1A] hover:border-[#D6D3D1]
                    transition-colors flex items-center justify-center"
                  aria-label="Открыть меню"
                  aria-expanded={mobileMenuOpen}
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-[20px] md:text-[26px] leading-[1.2] font-semibold text-[#1A1A1A] tracking-tight truncate min-w-0 flex-1">
                {title}
              </h1>
              <div ref={bellRef} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative w-10 h-10 rounded-xl bg-white border border-[#E7E5E4]
                    text-[#78716C] hover:text-[#1A1A1A] hover:border-[#D6D3D1]
                    aria-expanded:border-[#4F46E5] aria-expanded:text-[#4F46E5]
                    transition-[color,border-color] duration-200
                    flex items-center justify-center"
                  title="Уведомления"
                  aria-label="Уведомления"
                  aria-expanded={bellOpen}
                  aria-haspopup="dialog"
                >
                  <Bell className="w-5 h-5" />
                </button>
                {bellOpen && (
                  <div
                    role="dialog"
                    aria-label="Уведомления"
                    className="absolute right-0 top-[calc(100%+8px)] w-[320px] z-50
                      bg-white border border-[#E7E5E4] rounded-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)]
                      overflow-hidden fade-in"
                  >
                    <div className="px-4 py-3 border-b border-[#F5F5F4] flex items-center justify-between">
                      <p className="uppercase-mono text-[#78716C]">Уведомления</p>
                      <span className="text-[11px] font-mono text-[#A8A29E] tabular-nums">0</span>
                    </div>
                    <div className="px-4 py-8 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                        <BellOff className="w-5 h-5 text-[#A8A29E]" aria-hidden />
                      </div>
                      <p className="text-sm text-[#1A1A1A] font-medium mb-1">Пока пусто</p>
                      <p className="text-[13px] text-[#78716C] leading-relaxed">
                        Система уведомлений появится после пилота. Дайджест упавших AI-вызовов и
                        pending approvals приходит в Telegram chip_admin в 09:00 МСК.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto w-full">
          <QueueBanner />
        </div>

        <div className="px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
