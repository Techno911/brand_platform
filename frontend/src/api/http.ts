import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';
import type { AuthTokens } from '../types/api';

// Invariants:
//   - baseURL = '/api' (vite proxies in dev, nginx proxies in prod — backend never faces client directly).
//   - Access token в памяти Zustand, refresh в памяти + httponly cookie (не localStorage).
//   - 401 → попытка refresh; при неудаче — очистка стора и редирект на /login.

export const http = axios.create({
  baseURL: '/api',
  timeout: 120_000,
  withCredentials: true,
});

http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && cfg.headers) {
    cfg.headers.set('Authorization', `Bearer ${token}`);
  }
  return cfg;
});

let refreshing: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const current = useAuthStore.getState().refreshToken;
  if (!current) throw new Error('no refresh token');
  const res = await axios.post<AuthTokens>('/api/auth/refresh', { refreshToken: current });
  useAuthStore.getState().setTokens(res.data.accessToken, res.data.refreshToken);
  return res.data;
}

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const cfg = err.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (status === 401 && cfg && !cfg._retried) {
      cfg._retried = true;
      try {
        refreshing = refreshing ?? refreshTokens();
        const tokens = await refreshing;
        refreshing = null;
        if (cfg.headers) cfg.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        return http.request(cfg);
      } catch {
        refreshing = null;
        useAuthStore.getState().clear();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  },
);
