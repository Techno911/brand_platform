(() => {
const { Icon } = window;

window.LoginScreen = function LoginScreen() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', minHeight: '100vh' }}>
      {/* Left — dark hero */}
      <div style={{ background: '#1A1A1A', color: '#fff', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        {/* radial glow */}
        <div style={{ position: 'absolute', bottom: -120, right: -120, width: 420, height: 420, background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <img src="../../assets/logo-full-dark.png" alt="Чирков & Партнёры" style={{ height: 36, filter: 'invert(1) brightness(1.15)', alignSelf: 'flex-start' }} />

        <div style={{ position: 'relative' }}>
          <div className="font-display" style={{ fontSize: 40, lineHeight: 1.15, letterSpacing: '-0.02em', color: '#fff' }}>
            Линейно. По делу.<br />
            <span style={{ color: '#818CF8' }}>Методология 3.1.</span>
          </div>
          <div className="col" style={{ gap: 6, marginTop: 32, maxWidth: 360 }}>
            {['Слушаем клиента.', 'Вытаскиваем мотив.', 'Формулируем без клише.'].map(t => (
              <div key={t} style={{ fontSize: 16, color: '#D6D3D1' }}>{t}</div>
            ))}
          </div>
          <div className="col" style={{ gap: 14, marginTop: 40, maxWidth: 380 }}>
            {[
              '4 стадии за 8–12 рабочих дней',
              '3-уровневый валидатор на каждую формулировку',
              'Прозрачная себестоимость AI в маржу проекта',
            ].map((t, i) => (
              <div key={t} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                <span className="mono" style={{ width: 24, height: 24, borderRadius: 9999, background: 'rgba(129,140,248,0.15)', color: '#A5B4FC', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 14, color: '#D6D3D1', lineHeight: 1.55 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mono" style={{ fontSize: 12, color: '#57534E' }}>© 2026 Чирков и Партнёры · Бренд-платформа</div>
      </div>

      {/* Right — form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="umono" style={{ marginBottom: 16 }}>Вход в платформу</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 8px' }}>С возвращением</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 32px' }}>Войдите, чтобы продолжить работу с проектами ваших клиентов.</p>

          <form className="col" style={{ gap: 16 }}>
            <div>
              <label className="label">Email</label>
              <input className="input input-lg" placeholder="olga@chipandpartners.ru" />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input className="input input-lg" type="password" defaultValue="••••••••••" />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>Войти</button>
          </form>

          <p className="muted" style={{ fontSize: 12, marginTop: 24, lineHeight: 1.6, textAlign: 'center' }}>
            Доступ к платформе выдаёт проджект Чиркова после вводного звонка. <br />
            Забыли пароль — напишите в Telegram проджекту.
          </p>
        </div>
      </div>
    </div>
  );
};
})();
