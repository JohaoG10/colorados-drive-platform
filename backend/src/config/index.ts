import dotenv from 'dotenv';

dotenv.config();

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
