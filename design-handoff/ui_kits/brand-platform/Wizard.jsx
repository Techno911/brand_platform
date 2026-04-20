(() => {
const { Icon } = window;

window.WizardScreen = function WizardScreen() {
  const stages = [
    { n: 1, name: 'Портрет клиента', state: 'done' },
    { n: 2, name: 'Сессия с собственником', state: 'active' },
    { n: 3, name: 'Архетип и позиционирование', state: 'locked' },
    { n: 4, name: 'Четыре теста месседжа', state: 'locked' },
  ];
  const blocks = ['Challenge', 'Легенда', 'Ценности', 'Миссия'];
  const [block, setBlock] = React.useState(1);
  const [accepted, setAccepted] = React.useState([true, false, false, false]);

  return (
    <div style={{ margin: '-32px -32px 0' }}>
      {/* Sticky progress line */}
      <div style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E7E5E4', padding: '16px 32px', zIndex: 10 }}>
        <a href="#" className="muted" style={{ fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Icon name="ArrowLeft" className="w-3 h-3" /> К проекту «Белая Линия»
        </a>
        <div style={{ height: 2, background: '#EEF2FF', borderRadius: 9999, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ width: '37%', height: '100%', background: '#4F46E5' }} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {stages.map(s => (
            <button key={s.n} className="btn btn-sm" disabled={s.state === 'locked'}
              style={{
                background: s.state === 'active' ? '#4F46E5' : s.state === 'done' ? '#fff' : '#FAFAF9',
                color: s.state === 'active' ? '#fff' : s.state === 'done' ? '#1A1A1A' : '#A8A29E',
                borderColor: s.state === 'done' ? '#E7E5E4' : 'transparent',
                border: s.state === 'done' ? '1px solid #E7E5E4' : 'none',
              }}>
              {s.state === 'done' && <Icon name="CheckCircle2" className="w-3 h-3" style={{ color: '#22C55E' }} />}
              {s.state === 'locked' && <Icon name="Lock" className="w-3 h-3" />}
              Стадия {s.n}. {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="content">
        <div className="col" style={{ gap: 20 }}>
          <div>
            <div className="umono">Стадия 2 из 4</div>
            <h2 className="font-display" style={{ fontSize: 32, margin: '6px 0 0', letterSpacing: '-0.02em' }}>Сессия с собственником</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Four blocks. Claude задаёт провокационные вопросы — собственник отвечает вам, вы переносите ответы в систему.</p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {blocks.map((b, i) => (
              <button key={b} className={'tab' + (block === i ? ' active' : '')} onClick={() => setBlock(i)}>
                {accepted[i] && <Icon name="CheckCircle2" className="w-3 h-3" style={{ display: 'inline', color: '#22C55E', marginRight: 4, verticalAlign: 'middle' }} />}
                {b}
              </button>
            ))}
          </div>

          {/* 3-column: stepper / canvas / suffler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 300px)', gap: 20 }}>
            {/* Stepper */}
            <div className="card">
              <div className="card-body">
                <div className="umono" style={{ marginBottom: 12 }}>Маршрут блока</div>
                <div className="stepper">
                  {[
                    { title: 'Разогрев собственника', desc: 'Прошли — сохранено.', state: 'done' },
                    { title: 'Thinking-partner провокации', desc: '4 вопроса приняты.', state: 'done' },
                    { title: 'Сборка черновика легенды', desc: 'Сейчас здесь', state: 'active' },
                    { title: 'Принятие формулировки', desc: 'Будет доступно после сборки', state: 'todo' },
                  ].map((s, i) => (
                    <div key={i} className={'step' + (s.state === 'active' ? ' active' : s.state === 'done' ? ' done' : '')}>
                      <div className="num">{s.state === 'done' ? '✓' : String(i + 1).padStart(2, '0')}</div>
                      <div>
                        <div className="title">{s.title}</div>
                        <div className="desc">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="card elevated" style={{ position: 'relative' }}>
              <div className="card-body">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                  <div className="umono">Черновик легенды</div>
                  <span className="badge badge-soft-primary"><Icon name="Sparkles" className="w-3 h-3" /> AI-draft</span>
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: '#1A1A1A', margin: 0 }}>
                  Клиника «Белая Линия» родилась из одного наблюдения: в Москве 2018 года нельзя было просто зайти к стоматологу и уйти с чистыми зубами. Всегда — с коронкой, с планом на полгода, с тревогой. Олег Белов, сам пациент с двумя имплантами, открыл клинику для тех, кто хочет делать раз и правильно.
                </p>
                <div className="row" style={{ gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #E7E5E4', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => { const c = [...accepted]; c[block] = true; setAccepted(c); }}>
                    <Icon name="CheckCircle2" className="w-4 h-4" /> Принять
                  </button>
                  <button className="btn btn-secondary"><Icon name="RotateCcw" className="w-4 h-4" /> Пересгенерировать</button>
                  <button className="btn btn-ghost"><Icon name="Edit3" className="w-4 h-4" /> Править</button>
                  <span className="muted mono" style={{ fontSize: 12, marginLeft: 'auto', whiteSpace: 'nowrap' }}>+ 8 мин</span>
                </div>
              </div>
            </div>

            {/* Suffler */}
            <div className="col" style={{ gap: 12 }}>
              <div className="umono" style={{ paddingLeft: 4 }}>Суфлёр</div>
              <div className="hint">
                <div className="h"><Icon name="Sparkles" className="w-4 h-4" style={{ color: '#4F46E5' }} /> Не ускоряйте собственника</div>
                <div className="b">Провокационный вопрос работает 20–40 секунд. Не подсказывайте ответ первым.</div>
              </div>
              <div className="hint warn">
                <div className="h"><Icon name="AlertCircle" className="w-4 h-4" /> Избегайте клише</div>
                <div className="b">«Качество», «индивидуальный подход», «клиенто-ориентированный» — валидатор пометит красным.</div>
              </div>
              <div className="hint danger">
                <div className="h"><Icon name="AlertTriangle" className="w-4 h-4" /> Не упоминайте цены</div>
                <div className="b">В формулировках легенды не должно быть «скидок», «доступно», «премиум за ваши деньги».</div>
              </div>
            </div>
          </div>

          {/* Sticky bottom action bar */}
          <div className="stickybar" style={{ marginLeft: 0, marginRight: 0, margin: '8px -32px -32px', paddingLeft: 32, paddingRight: 32 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {blocks.map((b, i) => (
                <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: accepted[i] ? '#15803D' : '#78716C', whiteSpace: 'nowrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: accepted[i] ? '#22C55E' : '#D6D3D1', flexShrink: 0 }} /> {b}
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 10, flexShrink: 0 }}>
              <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{accepted.filter(Boolean).length} / 4</span>
              <button className="btn btn-primary" disabled={accepted.filter(Boolean).length < 4}>
                <Icon name="Send" className="w-4 h-4" /> На одобрение собственника
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
})();
