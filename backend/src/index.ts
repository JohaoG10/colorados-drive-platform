import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import authRouter from './routers/authRouter';
import adminRouter from './routers/adminRouter';
import studentRouter from './routers/studentRouter';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.nodeEnv === 'development' ? '*' : undefined }));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/student', studentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(config.port, () => {
  console.log(`Colorados Drive API running on port ${config.port}`);
});
