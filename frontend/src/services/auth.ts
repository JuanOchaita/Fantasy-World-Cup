import request, { setStoredAuthUser, setStoredRefreshToken, getStoredAuthUser } from './api';
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

function userFromLogin(email: string, accessToken: string): AuthUser {
  const id = jwtUserId(accessToken);
  return {
    id: id ?? '',
    username: email.split('@')[0] || 'player',
    email,
  };
}

export const authService = {
  login: async (data: LoginPayload) => {
    const tokens = await request<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    const user = userFromLogin(data.email, tokens.access_token);
    localStorage.setItem('auth_token', tokens.access_token);
    setStoredRefreshToken(tokens.refresh_token);
    setStoredAuthUser(user);
    return { token: tokens.access_token, user };
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

  verifySession: () => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No session');
    const exp = jwtExpMs(token);
    if (!exp || exp < Date.now()) throw new Error('Expired');
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
