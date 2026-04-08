import { getApiUrl, isApiUrlConfiguredForProduction } from '@/lib/env';

const API_URL = getApiUrl();

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'student' | 'instructor';
  courseId: string | null;
  instructorId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  if (!isApiUrlConfiguredForProduction(API_URL)) {
    throw new Error(
      'Configuracion de produccion incompleta: define NEXT_PUBLIC_API_URL en Vercel con la URL publica del backend.'
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Verifica NEXT_PUBLIC_API_URL en Vercel y CORS_ORIGIN en el backend.'
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body?.error === 'string' ? body.error : 'Error al iniciar sesión';
    throw new Error(msg);
  }
  return body;
}

export async function getMe(token: string): Promise<User> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function onSessionExpired(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener('colorados_session_expired', handler);
  return () => window.removeEventListener('colorados_session_expired', handler);
}

export function triggerSessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('colorados_session_expired'));
  }
}
