import 'dotenv/config';

import { crearApp } from './app.js';
import { cargarEnv } from './config/env.js';
import { conectarMongo } from './db/conexion.js';
import { asegurarAdminDesdeEnv } from './servicios/admin.bootstrap.js';

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
  app.listen(env.PORT, () => {
    console.warn(`API victoriasapp escuchando en http://localhost:${String(env.PORT)}`);
  });
}

void principal().catch((error: unknown) => {
  console.error('[api] no se pudo arrancar:', error);
  process.exitCode = 1;
});
