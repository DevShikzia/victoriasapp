import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { cargarEnv, origenesCors } from './config/env.js';

const env = cargarEnv();

const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: origenesCors(env),
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      status: 'up',
      entorno: env.NODE_ENV,
    },
  });
});

app.listen(env.PORT, () => {
  console.warn(`API victoriasapp escuchando en http://localhost:${String(env.PORT)}`);
});
