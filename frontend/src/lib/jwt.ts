/** Decode JWT payload without verifying signature (session UX only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jwtExpMs(token: string): number | null {
  const p = decodeJwtPayload(token);
  if (!p || typeof p.exp !== 'number') return null;
  return p.exp * 1000;
}

export function jwtUserId(token: string): string | null {
  const p = decodeJwtPayload(token);
  if (p == null || p.user_id == null) return null;
  return String(p.user_id);
}
