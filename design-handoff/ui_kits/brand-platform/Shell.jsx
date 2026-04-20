(() => {
const { Icon } = window;

window.Sidebar = function Sidebar({ role = 'chip_manager', active = '/dashboard' }) {
  const nav = [
    { path: '/dashboard', label: 'Главная', icon: 'FolderKanban' },
    { path: '/projects', label: 'Проекты', icon: 'FileText' },
    { path: '/approvals', label: 'Утверждения', icon: 'ShieldCheck' },
  ];
  const admin = [
    { path: '/admin/silent-failures', label: 'Silent failures', icon: 'AlertTriangle' },
    { path: '/admin/marketer-quality', label: 'Качество маркетологов', icon: 'BarChart3' },
    { path: '/admin/wizard-dropoff', label: 'Drop-off wizard', icon: 'TrendingDown' },
    { path: '/admin/golden-set', label: 'Golden set', icon: 'Target' },
    { path: '/admin/billing', label: 'Биллинг', icon: 'Wallet' },
    { path: '/admin/security', label: 'Безопасность', icon: 'Shield' },
    { path: '/admin/users', label: 'Пользователи', icon: 'Users' },
  ];
  const isAdmin = role === 'chip_admin';
  const user = {
    chip_admin: { name: 'Андрей Чирков', role: 'Владелец агентства', init: 'АЧ' },
    chip_manager: { name: 'Ольга Новикова', role: 'Проджект ЧиП', init: 'ОН' },
    marketer: { name: 'Игорь Белов', role: 'Маркетолог · Белая Линия', init: 'ИБ' },
    owner_viewer: { name: 'Александр Морозов', role: 'Собственник · Белая Линия', init: 'АМ' },
  }[role];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="../../assets/logo-full-dark.png" alt="Чирков & Партнёры" />
      </div>
      <nav className="sidebar-nav">
        <div className="nav-group">
          {nav.map(i => (
            <a key={i.path} href="#" className={'nav-item' + (active === i.path ? ' active' : '')}>
              <Icon name={i.icon} className="w-5 h-5" />
              <span>{i.label}</span>
            </a>
          ))}
        </div>
        {isAdmin && (<>
          <div className="nav-group-label">Администрирование</div>
          <div className="nav-group">
            {admin.map(i => (
              <a key={i.path} href="#" className={'nav-item' + (active === i.path ? ' active' : '')}>
                <Icon name={i.icon} className="w-5 h-5" />
                <span>{i.label}</span>
              </a>
            ))}
          </div>
        </>)}
      </nav>
      <div className="sidebar-foot">
        <div className="avatar">{user.init}</div>
        <div className="meta">
          <div className="name">{user.name}</div>
          <div className="role">{user.role}</div>
        </div>
        <button className="icon-btn" title="Выйти"><Icon name="LogOut" className="w-4 h-4" /></button>
      </div>
    </aside>
  );
};

window.Header = function Header({ title, breadcrumbs }) {
  return (
    <div className="header">
      <div className="titleblock">
        {breadcrumbs && (
          <div className="bread">
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <Icon name="ChevronRight" className="w-3 h-3 sep" style={{ color: 'var(--neutral-300)' }} />}
                {i === breadcrumbs.length - 1 ? <span className="curr">{b}</span> : <a>{b}</a>}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
      </div>
      <button className="bell" style={{ flexShrink: 0 }}><Icon name="Bell" className="w-5 h-5" /></button>
    </div>
  );
};

window.Shell = function Shell({ role, active, title, breadcrumbs, children }) {
  const { Sidebar, Header } = window;
  return (
    <div className="app">
      <Sidebar role={role} active={active} />
      <main className="main">
        <Header title={title} breadcrumbs={breadcrumbs} />
        <div className="content fade-in">{children}</div>
      </main>
    </div>
  );
};
})();
