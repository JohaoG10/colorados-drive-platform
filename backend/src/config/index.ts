import dotenv from 'dotenv';

dotenv.config();

/** Escapa caracteres especiales de regex en un literal */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** Convierte un patrón tipo "https://*.vercel.app" en RegExp (* = cualquier host). */
function patternToRegex(pattern: string): RegExp {
  const parts = pattern.split('*').map(escapeRegexLiteral);
  const regexStr = parts.join('[^/]+');
  return new RegExp(`^${regexStr}$`);
}

const CORS_EXACT_ORIGINS = new Set<string>();
const CORS_PATTERNS: RegExp[] = [];

const corsOriginEnv = (process.env.CORS_ORIGIN || '').trim();
if (corsOriginEnv) {
  for (const entry of corsOriginEnv.split(',')) {
    const value = entry.trim();
    if (!value) continue;
    if (value.includes('*')) {
      CORS_PATTERNS.push(patternToRegex(value));
    } else {
      CORS_EXACT_ORIGINS.add(value);
    }
  }
}

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

/**
 * Indica si un origen está permitido por CORS. Nunca se usa '*'.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin || typeof origin !== 'string') return false;
  const isDev = process.env.NODE_ENV !== 'production';
  const hasConfig = CORS_EXACT_ORIGINS.size > 0 || CORS_PATTERNS.length > 0;
  if (isDev && !hasConfig) return DEV_DEFAULT_ORIGINS.includes(origin);
  if (CORS_EXACT_ORIGINS.has(origin)) return true;
  return CORS_PATTERNS.some((re) => re.test(origin));
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
    jwtSecret: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET!,
  },
  jwt: {
    secret: process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};
