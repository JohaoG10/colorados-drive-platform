const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'student';
  courseId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
