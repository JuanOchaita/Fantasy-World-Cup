import request from './api';

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

export const authService = {
  login: (data: LoginPayload) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: RegisterPayload) =>
    request<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifySession: () =>
    request<{ user: AuthUser }>('/auth/verify'),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),
};
