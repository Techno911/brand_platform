import { create } from 'zustand';
import type { AuthUser } from '../types/api';

// Инвариант: JWT ЖИВЁТ В ПАМЯТИ, а не в localStorage (CLAUDE.md §ЗАПРЕТЫ).
// Страница обновилась — заходим через /auth/session с httponly refresh cookie.
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  ready: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthUser | null) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  ready: false,
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  clear: () => set({ accessToken: null, refreshToken: null, user: null, ready: true }),
}));
