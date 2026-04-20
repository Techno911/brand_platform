import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLATFORM } from '../config/platform';
import { http } from '../api/http';
import { useAuthStore } from '../store/auth';
import type { AuthTokens, AuthUser } from '../types/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// Ключ в localStorage для preset'а email при следующем заходе.
// ВАЖНО: храним ТОЛЬКО email, НЕ токены (см. CLAUDE.md — JWT не живёт в localStorage).
// refresh-token уже в httpOnly cookie, этот механизм только про удобство маркетолога:
// «поставил галку — не вводить email каждый раз».
const REMEMBER_KEY = 'bp.login.rememberedEmail';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  // Prefill email из localStorage, если предыдущий вход был с галкой «Запомнить меня».
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) ?? ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => {
    try { return !!localStorage.getItem(REMEMBER_KEY); } catch { return false; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Если пользователь снимает галку, чистим сохранённый email сразу — иначе следующий
  // заход всё ещё подставит его. Чекбокс на login — явный consent, трактуем буквально.
  useEffect(() => {
    if (!remember) {
      try { localStorage.removeItem(REMEMBER_KEY); } catch { /* storage недоступен — ОК */ }
    }
  }, [remember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await http.post<AuthTokens & { user: AuthUser }>('/auth/login', { email, password });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      // Persist email только после успешного login — иначе сохраним неправильный.
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // Приватный режим / iframe без storage — игнорируем, не фейлим login.
      }
      navigate('/dashboard');
    } catch (err: any) {
      // NestJS class-validator отдаёт message как string ИЛИ string[]. Раньше был баг:
      // массив join'ился в "email must be an emailpassword must be longer than or equal to 8"
      // (без разделителя). Теперь берём первое сообщение или обобщаем по-русски.
      const msg = err?.response?.data?.message;
      const text = Array.isArray(msg)
        ? 'Проверьте email и пароль: пароль от 8 символов, email в формате name@domain.tld'
        : (typeof msg === 'string' && msg && !/invalid credentials/i.test(msg))
        ? msg
        : 'Неверный email или пароль';
      setError(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Левая 40% тёмная панель — hero, логотип, методология.
          Padding 48px 56px = py-12 px-14 из handoff'а Login.jsx. */}
      <div className="hidden lg:flex lg:w-[40%] bg-[#1A1A1A] flex-col justify-between py-12 px-14 relative overflow-hidden">
        {/* Радиальное indigo-свечение 420×420 в нижнем правом углу (handoff Login.jsx:10). */}
        <div
          className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 65%)',
          }}
        />

        {/* TOP — логотип. Увеличен до h-20 (80px) под реф RO SaaS (ro.chirkov.info/login),
            где эмблем доминирует в верхней трети тёмной панели. Это обозначает
            «продукт бренд-мастерской Чиркова», а не «безымянный SaaS». На mobile
            (где hero-панель скрыта по lg:flex) не рендерится — там только форма. */}
        <img
          src="/brand/logo-full-dark.png"
          alt={PLATFORM.name}
          className="h-20 logo-invert relative z-10 self-start fade-in"
        />

        {/* MIDDLE — hero: h1 product + subtitle + 3 нумерованных taglines.
            Структура под новый copy: заголовок = название продукта, подзаголовок = описание в одну фразу,
            три пункта = сжатая методология. Один блок, justify-between делает распределение. */}
        <div className="relative z-10 fade-in">
          <h1 className="font-display text-[44px] leading-[1.1] tracking-[-0.02em] text-white">
            {PLATFORM.product}
          </h1>

          <p className="text-[#D6D3D1] text-[15px] leading-[1.55] mt-5 max-w-[400px]">
            {PLATFORM.subtitle}
          </p>

          <div className="flex flex-col gap-3.5 mt-10 max-w-[400px]">
            {PLATFORM.taglines.map((t, i) => (
              <div key={i} className="flex items-start gap-3.5">
                <span
                  className="font-mono flex-shrink-0 w-7 h-7 rounded-full
                    bg-[rgba(129,140,248,0.15)] text-[#A5B4FC]
                    text-[11px] font-semibold flex items-center justify-center tabular-nums"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-[#E7E5E4] text-[15px] flex-1 leading-[1.55]">{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM — копирайт один (handoff Login.jsx:37) */}
        <p className="text-[#57534E] text-xs font-mono relative z-10 fade-in-delayed">
          {PLATFORM.copyright}
        </p>
      </div>

      {/* Правая 60% белая панель — форма. Padding p-12 per handoff. */}
      <div className="w-full lg:w-[60%] bg-white flex items-center justify-center p-12">
        <div className="w-full max-w-[400px] fade-in-delayed">
          <p className="uppercase-mono mb-4">Вход в платформу</p>
          <h2 className="text-[28px] font-semibold text-[#1A1A1A] tracking-[-0.01em] mb-8">
            С возвращением
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="olga@chipandpartners.ru"
              sizeField="lg"
              required
              autoComplete="username"
              aria-label="Email"
              data-testid="login-email"
            />

            <Input
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              hint="Забыли — напишите трекеру."
              sizeField="lg"
              required
              autoComplete="current-password"
              aria-label="Пароль"
              data-testid="login-password"
            />

            {error && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-sm text-[#B91C1C]"
              >
                {error}
              </div>
            )}

            {/* Remember-me. Семантика: prefill email при следующем заходе с этого
                браузера. Токены НЕ затрагивает — refresh в httpOnly cookie живёт 7 дней
                независимо. Паттерн нативного <label> вокруг input — клик по тексту
                тоже переключает чекбокс, без JS. */}
            <label className="flex items-center gap-2 cursor-pointer select-none -mt-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#D6D3D1] text-[#4F46E5]
                  focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-0
                  cursor-pointer accent-[#4F46E5]"
                data-testid="login-remember"
              />
              <span className="text-sm text-[#44403C]">Запомнить меня</span>
            </label>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              fullWidth
              data-testid="login-submit"
            >
              {loading ? 'Входим…' : 'Войти'}
            </Button>
          </form>

          {/* Версия релиза. Бледный моно-шрифт, не конкурирует с CTA.
              Footer-подсказки удалены (дубли на password hint — лишний шум). */}
          <p className="text-[#D6D3D1] text-[11px] font-mono text-center mt-8 tracking-[0.06em]">
            {PLATFORM.product} · {PLATFORM.version}
          </p>
        </div>
      </div>
    </div>
  );
}
