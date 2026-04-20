(() => {
const { Icon } = window;

window.DashboardScreen = function DashboardScreen() {
  const projects = [
    { name: 'Белая Линия', client: 'Стоматология · Москва', stage: 2, days: 3, status: 'Стадия 2', color: 'primary' },
    { name: 'Премиум Кухни', client: 'Мебель · СПб', stage: 3, days: 6, status: 'Стадия 3', color: 'primary' },
    { name: 'Академия Моцарта', client: 'Детский центр · Казань', stage: 1, days: 9, status: 'Стадия 1', color: 'primary' },
    { name: 'Автотехцентр RS', client: 'Автосервис · Екб', stage: 4, days: 2, status: 'Стадия 4', color: 'primary' },
    { name: 'Ресторан «Пушкин»', client: 'HoReCa · Москва', stage: 2, days: 7, status: 'Стадия 2', color: 'primary' },
  ];

  return (
    <div className="col" style={{ gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Добрый день, Ольга</h2>
        <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>Claude готовит черновики, вы ставите подпись. Ниже — где вас ждут.</p>
      </div>

      {/* Next action */}
      <a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ border: '2px solid #4F46E5', background: '#EEF2FF', borderRadius: 20, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#4F46E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="PlayCircle" className="w-6 h-6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="umono" style={{ marginBottom: 2 }}>Ваше следующее действие</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>Продолжить стадию 2 в проекте «Белая Линия»</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Осталось 3 дня до дедлайна — начните сейчас.</div>
          </div>
          <Icon name="ArrowRight" className="w-5 h-5" style={{ color: '#4F46E5' }} />
        </div>
      </a>

      {/* Stats */}
      <div className="grid3">
        {[
          { label: 'Активных проектов', value: 5, icon: 'FolderKanban' },
          { label: 'Завершённых брендов', value: 12, icon: 'CheckCircle2' },
          { label: 'До дедлайна', value: '~5 дн.', icon: 'Clock' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body stat">
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <Icon name={s.icon} className="w-4 h-4" style={{ color: '#4F46E5' }} />
                <span className="umono">{s.label}</span>
              </div>
              <div className="num">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="g60-40">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Активные проекты</div>
            <a href="#" style={{ fontSize: 13, color: '#4F46E5', textDecoration: 'none', fontWeight: 500, display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Все проекты <Icon name="ArrowRight" className="w-3 h-3" />
            </a>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map(p => (
                <li key={p.name}>
                  <a href="#" style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: 14, borderRadius: 12, border: '1px solid #E7E5E4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client}</div>
                      </div>
                      <span className="badge badge-soft-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{p.status}</span>
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                      <div className="progress" style={{ flex: 1, minWidth: 0 }}><span style={{ width: `${(p.stage / 4) * 100}%` }} /></div>
                      <span className="mono" style={{ fontSize: 11, color: '#78716C', flexShrink: 0, whiteSpace: 'nowrap' }}>{p.stage}/4 · {p.days} дн.</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="row" style={{ gap: 8 }}>
                <Icon name="Wallet" className="w-4 h-4" style={{ color: '#4F46E5' }} />
                <div className="card-title">Бюджет проектов</div>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Потрачено</span>
                <span className="mono" style={{ fontSize: 13, color: '#1A1A1A', whiteSpace: 'nowrap' }}>$1 284 / $2 000</span>
              </div>
              <div className="progress"><span style={{ width: '64%' }} /></div>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>
                Остаток <span className="mono" style={{ color: '#1A1A1A' }}>$715.50</span> — по проектам, где вы проджект.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="row" style={{ gap: 8 }}>
                <Icon name="Sparkles" className="w-4 h-4" style={{ color: '#4F46E5' }} />
                <div className="card-title">Как устроена работа</div>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Claude готовит черновик — вы проверяете и редактируете.',
                  'Если сомневаетесь — не жмите «Принять». Справа есть суфлёр с подсказками.',
                  'Финальный документ подписывает только собственник бизнеса.',
                ].map((t, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="mono" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 9999, background: '#EEF2FF', color: '#4F46E5', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ margin: 0, fontSize: 12, color: '#44403C', lineHeight: 1.6, flex: 1, minWidth: 0 }}>{t}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
})();
