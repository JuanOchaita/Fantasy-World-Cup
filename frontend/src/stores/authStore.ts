import { create } from 'zustand';
import type { AuthUser } from '@/services/auth';
import { authService } from '@/services/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { token, user } = await authService.login({ email, password });
    localStorage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true });
  },

  register: async (username, email, password, confirmPassword) => {
    const { token, user } = await authService.registerAndLogin({
      username,
      email,
      password,
      confirmPassword,
    });
    localStorage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    authService.logout();
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkSession: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const { user } = await authService.verifySession();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('auth_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
