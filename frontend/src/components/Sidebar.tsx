import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut, X } from 'lucide-react';
import { PLATFORM } from '../config/platform';
import Avatar from './ui/Avatar';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Группа для визуального разделителя. `main` — по умолчанию, `admin` — под разделителем. */
  group?: 'main' | 'admin';
}

interface SidebarProps {
  navItems: NavItem[];
  userName: string;
  userRole: string;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Мобильный режим (<768px). На нём sidebar рендерится как drawer. */
  isMobile?: boolean;
  /** Открыт ли mobile-drawer. Игнорируется на desktop. */
  mobileOpen?: boolean;
  /** Закрыть mobile-drawer (клик по ссылке, клик по backdrop, Esc). */
  onCloseMobile?: () => void;
  /** Подзаголовок под названием продукта в шапке. Обычно — имя текущего проекта ("Белая Линия")
   *  или workspace ("Чирков & Партнёры"). Layout подставляет динамически. */
  workspaceSubtitle?: string;
}

// Разделитель между группами — используется если в navItems есть хотя бы один item с group='admin'.
function NavGroup({
  items,
  isOpen,
  currentPath,
  onNavigate,
}: {
  items: NavItem[];
  isOpen: boolean;
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive =
          currentPath === item.path || currentPath.startsWith(item.path + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#4F46E5] text-white'
                : 'text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white'
            } ${!isOpen ? 'justify-center' : ''}`}
            title={!isOpen ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  navItems, userName, userRole, onLogout, isOpen, setIsOpen,
  isMobile = false, mobileOpen = false, onCloseMobile,
  workspaceSubtitle,
}: SidebarProps) {
  const location = useLocation();

  // Разделяем навигацию на две группы.
  const mainItems = navItems.filter((i) => (i.group ?? 'main') === 'main');
  const adminItems = navItems.filter((i) => i.group === 'admin');

  // На мобиле drawer всегда раскрыт (260px с лейблами). Collapse-toggle только desktop.
  const effectiveOpen = isMobile ? true : isOpen;
  const width = isMobile ? 260 : (isOpen ? 240 : 64);

  // Mobile drawer: transform translateX для slide-in, без пересчёта ширины
  // (ширина всегда 260 чтобы labels помещались).
  const mobileTransform = isMobile
    ? mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
    : 'translateX(0)';

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-[#1A1A1A] flex flex-col z-40 overflow-hidden transition-[width,transform] duration-300 ease-out"
      style={{ width, transform: mobileTransform }}
      aria-label="Главная навигация"
      aria-hidden={isMobile && !mobileOpen}
    >
      {/* Brand-шапка — крупный эмблем + название продукта + подзаголовок (workspace/проект).
          Кликабельная: ведёт на /dashboard. Паттерн портирован из RO SaaS (см. реф).
          - expanded (240/260): эмблем 44×44 + две строки (title + subtitle).
          - collapsed (64): эмблем 40×40, центрируем ВСЮ шапку через justify-center,
            без mx-auto / отрицательных margin'ов — иначе PNG с внутренним alpha-padding
            плюс `justify-between` с одним ребёнком даёт оптическое смещение влево
            (пользователь видел это на скриншоте). */}
      <div
        className={[
          'px-3 pt-4 pb-3 flex items-center gap-3 min-h-[72px]',
          effectiveOpen ? 'justify-between' : 'justify-center',
        ].join(' ')}
      >
        <Link
          to="/dashboard"
          onClick={isMobile ? onCloseMobile : undefined}
          className={`flex items-center gap-3 rounded-xl transition-colors
            hover:bg-[#2A2A2A] ${effectiveOpen ? 'flex-1 min-w-0 p-2 -m-2' : 'p-1.5'}`}
          title={!effectiveOpen ? `${PLATFORM.product} — на главную` : undefined}
          aria-label={`${PLATFORM.product} — на главную`}
        >
          <img
            src="/brand/logo-emblem-light.png"
            alt=""
            aria-hidden="true"
            className={
              effectiveOpen
                ? 'h-11 w-11 flex-shrink-0 object-contain'
                : 'h-10 w-10 flex-shrink-0 object-contain'
            }
          />
          {effectiveOpen && (
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-white text-[15px] font-semibold truncate tracking-[-0.01em]">
                {PLATFORM.product}
              </p>
              <p className="text-[#9CA3AF] text-[12px] font-mono truncate">
                {workspaceSubtitle ?? PLATFORM.name}
              </p>
            </div>
          )}
        </Link>
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-8 h-8 flex items-center justify-center rounded-lg
              text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A] transition-colors flex-shrink-0"
            aria-label="Закрыть меню"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <NavGroup
          items={mainItems}
          isOpen={effectiveOpen}
          currentPath={location.pathname}
          onNavigate={isMobile ? onCloseMobile : undefined}
        />

        {adminItems.length > 0 && (
          <>
            {/* Разделитель + лейбл группы (только когда открыт) */}
            <div className="mt-4 mb-2">
              {effectiveOpen ? (
                <p className="px-3 font-mono uppercase text-[10px] font-medium tracking-[0.08em] text-[#57534E]">
                  Администрирование
                </p>
              ) : (
                <div className="mx-3 border-t border-[#2A2A2A]" />
              )}
            </div>
            <NavGroup
              items={adminItems}
              isOpen={effectiveOpen}
              currentPath={location.pathname}
              onNavigate={isMobile ? onCloseMobile : undefined}
            />
          </>
        )}
      </nav>

      {/* Collapse toggle — только desktop. На мобиле drawer всегда full-width. */}
      {!isMobile && (
        <div className="px-3 py-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm
              text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white transition-colors"
            title={isOpen ? 'Свернуть' : 'Развернуть'}
            aria-label={isOpen ? 'Свернуть боковую панель' : 'Развернуть боковую панель'}
          >
            <ChevronLeft
              className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                !isOpen ? 'rotate-180' : ''
              }`}
            />
            {isOpen && <span>Свернуть</span>}
          </button>
        </div>
      )}

      <div className="mx-3 border-t border-[#2A2A2A]" />

      {/* User + logout (logout ТОЛЬКО тут, per CLAUDE.md).
          Dual-layout: expanded=avatar+meta+logout в ряд (240px); collapsed=ТОЛЬКО logout по центру (64px).
          В collapsed-режиме 32+12+32=76px контент не помещался в 40px inner — logout вылезал в main-content.
          Паттерн портирован из RO SaaS Sidebar.tsx:174-229. */}
      <div className="p-3">
        {effectiveOpen ? (
          <div className="flex items-center gap-3">
            <Avatar name={userName} size="sm" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{userName}</p>
              <p className="text-[#9CA3AF] text-xs truncate">{userRole}</p>
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0
                text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.12)]
                transition-colors"
              title="Выйти"
              aria-label="Выйти из системы"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center p-1.5 rounded-lg
              text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.12)]
              transition-colors"
            title="Выйти"
            aria-label="Выйти из системы"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
