import 'dotenv/config';

import { createServer } from 'node:http';

import { crearApp } from './app.js';
import { cargarEnv } from './config/env.js';
import { conectarMongo } from './db/conexion.js';
import { asegurarAdminDesdeEnv } from './servicios/admin.bootstrap.js';
import { crearServidorTiempoReal } from './tiempo-real/socket.js';

async function principal(): Promise<void> {
  const env = cargarEnv();

  await conectarMongo(env.MONGODB_URI);

  const bootstrap = await asegurarAdminDesdeEnv(env);
  if (bootstrap.creado) {
    console.warn(`[admin] Administrador "${env.ADMIN_USUARIO}" creado desde el entorno.`);
  } else if (bootstrap.actualizado) {
    console.warn(
      `[admin] Contraseña de "${env.ADMIN_USUARIO}" reseteada (ADMIN_FORZAR_RESET=true).`,
    );
  } else if (env.ADMIN_PASSWORD === undefined) {
    console.warn(
      '[admin] No se definió ADMIN_PASSWORD: no se creó ningún administrador. Ver .env.example.',
    );
  }

  const app = crearApp(env);
  const httpServer = createServer(app);
  crearServidorTiempoReal(httpServer, env);
  httpServer.listen(env.PORT, () => {
    console.warn(`API MatiApp escuchando en http://localhost:${String(env.PORT)}`);
  });
}

void principal().catch((error: unknown) => {
  console.error('[api] no se pudo arrancar:', error);
  process.exitCode = 1;
});
