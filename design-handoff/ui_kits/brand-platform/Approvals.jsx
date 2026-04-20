(() => {
const { Icon } = window;

window.ApprovalsScreen = function ApprovalsScreen() {
  const artifacts = [
    { id: 's2-legend', stage: 2, name: 'Легенда бренда', status: 'review' },
    { id: 's2-values', stage: 2, name: 'Ценности бренда', status: 'approved' },
    { id: 's2-mission', stage: 2, name: 'Миссия', status: 'approved' },
    { id: 's3-pos', stage: 3, name: 'Позиционирование', status: 'pending' },
    { id: 's3-msg', stage: 3, name: 'Финальный месседж', status: 'pending' },
  ];
  const [sel, setSel] = React.useState('s2-legend');

  return (
    <div style={{ margin: '-32px -32px 0', height: 'calc(100vh - 72px)', display: 'grid', gridTemplateColumns: '280px 1fr 340px' }}>
      {/* Left — artifact list */}
      <div style={{ borderRight: '1px solid #E7E5E4', overflow: 'auto', padding: 16 }}>
        <div className="umono" style={{ padding: '8px 12px' }}>Артефакты проекта</div>
        <div className="col" style={{ gap: 2 }}>
          {artifacts.map(a => (
            <button key={a.id} onClick={() => setSel(a.id)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: 0, cursor: 'pointer',
                background: sel === a.id ? '#EEF2FF' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
              {a.status === 'approved' ? <Icon name="CheckCircle2" className="w-4 h-4" style={{ color: '#22C55E' }} /> :
               a.status === 'review' ? <Icon name="Clock" className="w-4 h-4" style={{ color: '#EAB308' }} /> :
               <Icon name="Dot" className="w-4 h-4" style={{ color: '#D6D3D1' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 10, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Стадия {a.stage}</div>
                <div style={{ fontSize: 13, color: sel === a.id ? '#3730A3' : '#1A1A1A', fontWeight: 500, marginTop: 2 }}>{a.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Center — document */}
      <div style={{ overflow: 'auto', background: '#FAFAF9' }}>
        <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', border: '1px solid #E7E5E4', borderRadius: 20, padding: '40px 56px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div className="umono">Стадия 2 · Артефакт</div>
              <div style={{ fontSize: 13, color: '#78716C', marginTop: 4 }}>Immutable draft · v3 · 14 апр 2026, 15:02 МСК</div>
            </div>
            <span className="badge badge-soft-warning"><Icon name="Clock" className="w-3 h-3" /> На ревью</span>
          </div>
          <h2 className="font-display" style={{ fontSize: 30, margin: '0 0 28px', letterSpacing: '-0.02em' }}>Легенда бренда</h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: '#1A1A1A', margin: '0 0 18px' }}>
            Клиника «Белая Линия» родилась из одного наблюдения: в Москве 2018 года нельзя было просто зайти к стоматологу и уйти с чистыми зубами. Всегда — <span style={{ background: '#FEF9C3', padding: '1px 3px', borderRadius: 4 }}>с коронкой, с планом на полгода, с тревогой</span>.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: '#1A1A1A', margin: '0 0 18px' }}>
            Олег Белов, сам пациент с двумя имплантами, открыл клинику для тех, кто хочет делать раз и правильно. Без впаривания, без этажерки услуг. Приём длится на 20 минут дольше нормы, потому что мы считаем что лучше объяснить один раз подробно, чем потом чинить два раза.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: '#1A1A1A', margin: '0 0 28px' }}>
            За семь лет клиника выросла с одного кресла до четырёх. Команда из 18 человек. Ни одного случая возврата по жалобе — в городе, где средний возврат по стоматологии 3%.
          </p>
          <div style={{ padding: '12px 16px', background: '#FEFCE8', borderLeft: '3px solid #EAB308', borderRadius: 8, fontSize: 13, color: '#713F12', lineHeight: 1.6 }}>
            <b>Ваша подпись создаст immutable snapshot.</b> Отменить нельзя. S3 ObjectLock, 7 лет retention.
          </div>
        </div>

        {/* Sticky action bar */}
        <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid #E7E5E4', padding: 16 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost"><Icon name="MessageSquare" className="w-4 h-4" /> Комментарий</button>
            <button className="btn btn-secondary"><Icon name="Edit3" className="w-4 h-4" /> Запросить правки</button>
            <button className="btn btn-primary"><Icon name="ShieldCheck" className="w-4 h-4" /> Одобрить</button>
          </div>
        </div>
      </div>

      {/* Right — thread */}
      <div style={{ borderLeft: '1px solid #E7E5E4', overflow: 'auto', padding: 20 }}>
        <div className="umono" style={{ marginBottom: 16 }}>Обсуждение · 2</div>
        <div className="col" style={{ gap: 14 }}>
          <div style={{ padding: 14, border: '1px solid #E7E5E4', borderRadius: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>АМ</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Александр Морозов</div>
              <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>вчера, 18:42</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#44403C', lineHeight: 1.6 }}>Про «20 минут дольше нормы» — пусть будет «на 30 минут». Мы действительно столько держим приём.</p>
          </div>
          <div style={{ padding: 14, border: '1px solid #E7E5E4', borderRadius: 16, background: '#FAFAF9' }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>ОН</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Ольга Новикова</div>
              <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>вчера, 19:10</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#44403C', lineHeight: 1.6 }}>Поправила и пересобрала. Обратите внимание на второй абзац — формулировка теперь точнее.</p>
          </div>
          <textarea className="input" placeholder="Написать комментарий…" style={{ minHeight: 80 }} />
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
            <Icon name="Send" className="w-4 h-4" /> Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
})();
