(() => {
const { Icon } = window;

window.AdminScreen = function AdminScreen() {
  const rows = [
    { id: 'run_2k9d3fa817', cmd: 'stage2.legend.draft', status: 'timeout', code: 'UPSTREAM_TIMEOUT', retry: 4, latency: 32140, at: '14.04.2026, 14:32' },
    { id: 'run_88fg2m0c01', cmd: 'stage3.positioning.validate', status: 'retry', code: 'VALIDATION_FAIL', retry: 3, latency: 12480, at: '14.04.2026, 14:19' },
    { id: 'run_1a0b4c7e91', cmd: 'stage4.test.tone', status: 'blocked', code: 'BRIEF_SANITIZE_PII', retry: 0, latency: 812, at: '14.04.2026, 13:58' },
    { id: 'run_f3ad09b1c2', cmd: 'stage1.portrait.extract', status: 'retry', code: 'JSON_SCHEMA_FAIL', retry: 3, latency: 18220, at: '14.04.2026, 13:47' },
    { id: 'run_77e1c2d3a4', cmd: 'stage2.values.draft', status: 'timeout', code: 'UPSTREAM_TIMEOUT', retry: 4, latency: 41010, at: '14.04.2026, 13:21' },
  ];

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Intro card */}
      <div className="card elevated" style={{ padding: 20, display: 'flex', gap: 16 }}>
        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="AlertTriangle" className="w-5 h-5" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Silent failures — prompt-run журнал</h3>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>
            Все retry &gt; N, таймауты и заблокированные вызовы. Смотрим глазами каждое утро. Telegram-дайджест уходит в 09:00 МСК.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="row" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <label className="umono">Retry порог</label>
          <input className="input" defaultValue="3" style={{ width: 80, textAlign: 'center' }} />
        </div>
        <button className="btn btn-secondary btn-sm"><Icon name="RotateCcw" className="w-4 h-4" /> Обновить</button>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 12, color: '#78716C' }}>
          <span className="badge badge-soft-danger" style={{ marginRight: 8 }}>5 новых</span>
          всего 23 за 24 ч
        </span>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className="tab active">Все <span className="mono muted" style={{ fontSize: 11, marginLeft: 4 }}>23</span></button>
        <button className="tab">По команде <span className="mono muted" style={{ fontSize: 11, marginLeft: 4 }}>8</span></button>
        <button className="tab">По ошибке <span className="mono muted" style={{ fontSize: 11, marginLeft: 4 }}>4</span></button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID запуска</th>
              <th>Команда</th>
              <th>Статус</th>
              <th>Код ошибки</th>
              <th style={{ textAlign: 'right' }}>Retry</th>
              <th style={{ textAlign: 'right' }}>Latency</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><span className="mono" style={{ fontSize: 12, background: '#F5F5F4', padding: '2px 6px', borderRadius: 6 }}>{r.id}</span></td>
                <td className="mono" style={{ fontSize: 13, color: '#44403C' }}>{r.cmd}</td>
                <td>
                  {r.status === 'timeout' && <span className="badge badge-soft-danger">Timeout</span>}
                  {r.status === 'retry' && <span className="badge badge-soft-warning">Retry</span>}
                  {r.status === 'blocked' && <span className="badge badge-soft-neutral">Blocked</span>}
                </td>
                <td className="mono" style={{ fontSize: 12, color: '#78716C' }}>{r.code}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{r.retry}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: 13, color: r.latency > 20000 ? '#B91C1C' : '#44403C' }}>{(r.latency/1000).toFixed(2)} s</td>
                <td className="mono" style={{ fontSize: 12, color: '#78716C' }}>{r.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
})();
