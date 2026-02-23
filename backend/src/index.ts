import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, isOriginAllowed } from './config';
import { supabaseAdmin } from './config/supabase';
import authRouter from './routers/authRouter';
import adminRouter from './routers/adminRouter';
import studentRouter from './routers/studentRouter';

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, origin ?? true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);

/** Endpoint público para keep-alive: que un cron externo llame cada 10 min para que backend y Supabase no se duerman. */
app.get('/health', async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  let db = 'unknown';
  try {
    await supabaseAdmin.from('user_profiles').select('id').limit(1).maybeSingle();
    db = 'ok';
  } catch {
    db = 'error';
  }
  res.json({ status: 'ok', timestamp, db });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(config.port, () => {
  console.log(`Colorados Drive API running on port ${config.port}`);
});
