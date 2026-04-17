const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

const AUTH_USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredAuthUser(): { id: string; username: string; email: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as { id: string; username: string; email: string };
    if (u?.id && u?.username) return u;
    return null;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: { id: string; username: string; email: string } | null): void {
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const text = await res.text();
  const trimmed = text.trim();

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (trimmed && !trimmed.startsWith('<')) {
      try {
        const json = JSON.parse(trimmed) as { error?: string; message?: string };
        msg = json.error || json.message || msg;
      } catch {
        msg = trimmed.slice(0, 200) || msg;
      }
    }
    throw new Error(msg);
  }

  if (!trimmed) return undefined as T;
  return JSON.parse(trimmed) as T;
}

export default request;
export { API_BASE };
