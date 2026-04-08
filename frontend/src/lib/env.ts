const LOCAL_API_FALLBACK = 'http://localhost:3001';

function normalizeApiUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Resuelve la URL base del backend.
 * - En desarrollo permite fallback local.
 * - En producción usa el valor configurado; si falta, mantiene fallback para no romper build.
 *   La validacion estricta se hace antes de llamadas criticas (ej. login).
 */
export function getApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return normalizeApiUrl(raw);
  return LOCAL_API_FALLBACK;
}

export function isApiUrlConfiguredForProduction(apiUrl: string): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return !/localhost|127\.0\.0\.1/i.test(apiUrl);
}
