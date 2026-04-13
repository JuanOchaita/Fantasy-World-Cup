const API_BASE = '/api';

// Mock mode: set to false once your real backend is running
const USE_MOCK = true;

const mockHandlers: Record<string, (body?: any) => any> = {
  'POST /auth/login': (body) => {
    if (!body?.email || !body?.password) throw new Error('Email and password required');
    return {
      token: 'mock-jwt-token-' + Date.now(),
      user: { id: '1', username: body.email.split('@')[0], email: body.email },
    };
  },
  'POST /auth/register': (body) => {
    if (!body?.username || !body?.email || !body?.password) throw new Error('All fields required');
    return {
      token: 'mock-jwt-token-' + Date.now(),
      user: { id: '1', username: body.username, email: body.email },
    };
  },
  'GET /auth/verify': () => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No session');
    return { user: { id: '1', username: 'player', email: 'player@example.com' } };
  },
  'POST /auth/logout': () => undefined,
};

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (USE_MOCK) {
    const method = (options?.method || 'GET').toUpperCase();
    const key = `${method} ${endpoint}`;
    const handler = mockHandlers[key];
    if (handler) {
      await new Promise((r) => setTimeout(r, 300)); // simulate latency
      const body = options?.body ? JSON.parse(options.body as string) : undefined;
      return handler(body) as T;
    }
  }

  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (!text.trimStart().startsWith('<')) {
        const json = JSON.parse(text);
        msg = json.message || msg;
      }
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export default request;
