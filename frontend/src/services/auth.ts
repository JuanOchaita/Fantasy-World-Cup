import request, { setStoredAuthUser, setStoredRefreshToken, getStoredAuthUser, getStoredRefreshToken } from './api';
import { jwtExpMs, jwtUserId } from '@/lib/jwt';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterApiResponse {
  message: string;
  user_id: number;
  username: string;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
}
interface LoginResponse extends TokenPair {
  user: {
    id: number | string;
    username: string;
    email: string;
  };
}

export const authService = {
  login: async (data: LoginPayload) => {
    const res = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    const user: AuthUser = {
      id: String(res.user.id),
      username: res.user.username,
      email: res.user.email,
    };
    localStorage.setItem('auth_token', res.access_token);
    setStoredRefreshToken(res.refresh_token);
    setStoredAuthUser(user);
    return { token: res.access_token, user };
  },

  register: async (data: RegisterPayload) => {
    const { confirmPassword: _, ...body } = data;
    return request<RegisterApiResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Register then log in (signup response does not include JWT). */
  registerAndLogin: async (data: RegisterPayload) => {
    const reg = await authService.register(data);
    const { token, user } = await authService.login({ email: data.email, password: data.password });
    const merged: AuthUser = {
      id: String(reg.user_id),
      username: reg.username,
      email: user.email,
    };
    setStoredAuthUser(merged);
    return { token, user: merged };
  },

  verifySession: async () => {
    let token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No session');
    const exp = jwtExpMs(token);
    if (!exp || exp < Date.now()) {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) throw new Error('Expired');
      const refreshed = await request<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      token = refreshed.access_token;
      localStorage.setItem('auth_token', refreshed.access_token);
      setStoredRefreshToken(refreshed.refresh_token);
    }
    const user = getStoredAuthUser();
    if (user) return { user };
    const id = jwtUserId(token);
    if (!id) throw new Error('No session');
    return { user: { id, username: 'player', email: '' } };
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    setStoredRefreshToken(null);
    setStoredAuthUser(null);
  },
};
