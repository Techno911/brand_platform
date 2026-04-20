(() => {
const { Icon } = window;

window.ProjectsScreen = function ProjectsScreen() {
  const [filter, setFilter] = React.useState('active');
  const projects = [
    { name: 'Белая Линия', client: 'Стоматология · Москва', industry: 'Здоровье', tariff: 'Standard', stage: 2, budget: 64, status: 'active' },
    { name: 'Премиум Кухни', client: 'Мебель · СПб', industry: 'Мебель', tariff: 'Premium', stage: 3, budget: 42, status: 'active' },
    { name: 'Академия Моцарта', client: 'Детский центр · Казань', industry: 'Образование', tariff: 'Economy', stage: 1, budget: 18, status: 'active' },
    { name: 'Автотехцентр RS', client: 'Автосервис · Екб', industry: 'Авто', tariff: 'Standard', stage: 4, budget: 87, status: 'active' },
    { name: 'Ресторан «Пушкин»', client: 'HoReCa · Москва', industry: 'HoReCa', tariff: 'Premium', stage: 2, budget: 33, status: 'active' },
    { name: 'Студия «Нота»', client: 'Салон красоты · Москва', industry: 'Красота', tariff: 'Standard', stage: 4, budget: 96, status: 'finalized' },
  ];

  const visible = projects.filter(p => filter === 'all' || p.status === filter);
  const filters = [
    { id: 'active', label: 'Активные', count: projects.filter(p => p.status === 'active').length },
    { id: 'finalized', label: 'Завершённые', count: projects.filter(p => p.status === 'finalized').length },
    { id: 'archived', label: 'В архиве', count: 0 },
    { id: 'all', label: 'Все', count: projects.length },
  ];

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Toolbar */}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <Icon name="Search" className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A8A29E' }} />
          <input className="input" placeholder="Поиск по бренду или клиенту" style={{ paddingLeft: 36 }} />
        </div>
        <div className="row" style={{ gap: 4, padding: 4, background: '#F5F5F4', borderRadius: 12 }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="btn btn-sm"
              style={{
                background: filter === f.id ? '#fff' : 'transparent',
                color: filter === f.id ? '#1A1A1A' : '#78716C',
                boxShadow: filter === f.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 0,
              }}>
              {f.label}
              <span className="mono" style={{ fontSize: 11, color: filter === f.id ? '#4F46E5' : '#A8A29E', marginLeft: 4 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary"><Icon name="Plus" className="w-4 h-4" /> Новый проект</button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {visible.map(p => (
          <a key={p.name} href="#" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client}</div>
                </div>
                {p.status === 'finalized' ? (
                  <span className="badge badge-soft-success" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}><Icon name="CheckCircle2" className="w-3 h-3" /> Финал</span>
                ) : (
                  <span className="badge badge-soft-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>Стадия {p.stage}</span>
                )}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-soft-neutral">{p.industry}</span>
                <span className="badge badge-soft-neutral">{p.tariff}</span>
              </div>
              <div style={{ paddingTop: 12, borderTop: '1px solid #E7E5E4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div className="umono" style={{ marginBottom: 6 }}>Стадия</div>
                  <div className="row" style={{ gap: 6 }}>
                    <div className="progress" style={{ height: 6 }}><span style={{ width: `${(p.stage/4)*100}%` }} /></div>
                    <span className="mono" style={{ fontSize: 11, color: '#78716C' }}>{p.stage}/4</span>
                  </div>
                </div>
                <div>
                  <div className="umono" style={{ marginBottom: 6 }}>Бюджет</div>
                  <div className="row" style={{ gap: 6 }}>
                    <div className={'progress ' + (p.budget > 85 ? 'warning' : '')} style={{ height: 6 }}><span style={{ width: `${p.budget}%` }} /></div>
                    <span className="mono" style={{ fontSize: 11, color: '#78716C' }}>{p.budget}%</span>
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
})();
