import type { Express } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../app.js';
import { cargarEnv, type Env } from '../config/env.js';
import { conectarMongo } from '../db/conexion.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { asegurarAdminDesdeEnv } from '../servicios/admin.bootstrap.js';

// Usa el binario ya cacheado para no depender de la red.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION ?? '7.0.24';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const SECRETO = 'a'.repeat(40);
const SECRETO_REFRESH = 'b'.repeat(40);
const CLAVE_ADMIN = 'admin12345';

interface CuerpoLogin {
  readonly data: {
    readonly accessToken: string;
    readonly usuario: { readonly usuario: string; readonly rol: string };
  };
}

let mongo: MongoMemoryServer;
let env: Env;
let app: Express;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  env = cargarEnv({
    NODE_ENV: 'test',
    MONGODB_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: SECRETO,
    JWT_REFRESH_SECRET: SECRETO_REFRESH,
    ADMIN_USUARIO: 'admin',
    ADMIN_NOMBRE: 'Admin Test',
    ADMIN_PASSWORD: CLAVE_ADMIN,
  });
  await conectarMongo(env.MONGODB_URI);
  await asegurarAdminDesdeEnv(env);
  app = crearApp(env);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

function cuerpoJson(respuesta: { body: unknown }): unknown {
  return respuesta.body;
}

async function tokenAdmin(): Promise<string> {
  const respuesta = await request(app)
    .post('/api/auth/login')
    .send({ usuario: 'admin', password: CLAVE_ADMIN })
    .expect(200);
  const cuerpo = cuerpoJson(respuesta) as CuerpoLogin;
  return cuerpo.data.accessToken;
}

describe('bootstrap del administrador', () => {
  it('creó el admin desde las variables de entorno', async () => {
    const doc = await UsuarioModel.findOne({ usuario: 'admin' });
    expect(doc).not.toBeNull();
    expect(doc?.rol).toBe('admin');
    expect(doc?.activo).toBe(true);
  });

  it('es idempotente: repetirlo no vuelve a crear ni actualizar', async () => {
    const resultado = await asegurarAdminDesdeEnv(env);
    expect(resultado.creado).toBe(false);
    expect(resultado.actualizado).toBe(false);
  });

  it('resetea la contraseña con ADMIN_FORZAR_RESET=true', async () => {
    const resultado = await asegurarAdminDesdeEnv({
      ...env,
      ADMIN_FORZAR_RESET: true,
      ADMIN_PASSWORD: 'nuevaClave99',
    });
    expect(resultado.actualizado).toBe(true);
    await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'nuevaClave99' })
      .expect(200);
    // Restauramos la clave original para el resto de las pruebas.
    await asegurarAdminDesdeEnv({ ...env, ADMIN_FORZAR_RESET: true });
  });
});

describe('autenticación', () => {
  it('rechaza credenciales inválidas con 401', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'incorrecta' })
      .expect(401);
  });

  it('rechaza un body inválido con 400', async () => {
    await request(app).post('/api/auth/login').send({ usuario: 'admin' }).expect(400);
  });

  it('loguea y devuelve el usuario en /me', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const cuerpo = cuerpoJson(respuesta) as { data: { usuario: string; rol: string } };
    expect(cuerpo.data.usuario).toBe('admin');
    expect(cuerpo.data.rol).toBe('admin');
  });

  it('protege /me sin token', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('renueva el access token con la cookie de refresh', async () => {
    const agente = request.agent(app);
    await agente
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: CLAVE_ADMIN })
      .expect(200);
    const respuesta = await agente.post('/api/auth/refresh').expect(200);
    const cuerpo = cuerpoJson(respuesta) as CuerpoLogin;
    expect(typeof cuerpo.data.accessToken).toBe('string');
  });
});

describe('usuarios (RBAC)', () => {
  it('un admin puede crear un guardia', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ usuario: 'guardia1', nombre: 'Guardia Uno', password: 'clave12345', rol: 'guardia' })
      .expect(201);
    const cuerpo = cuerpoJson(respuesta) as {
      ok: boolean;
      data: { usuario: string; rol: string };
    };
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.data.usuario).toBe('guardia1');
    expect(cuerpo.data.rol).toBe('guardia');
  });

  it('un guardia no puede listar usuarios (403)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'guardia1', password: 'clave12345' })
      .expect(200);
    const token = (cuerpoJson(login) as CuerpoLogin).data.accessToken;
    await request(app).get('/api/users').set('Authorization', `Bearer ${token}`).expect(403);
  });
});

describe('sincronización de visitas', () => {
  const visita = {
    uuid: 'b1c2d3e4',
    tipo: 'ingreso',
    apellido: 'PEREZ',
    nombre: 'JUAN',
    dni: '30123456',
    entradaEn: '2026-10-13T12:00:00.000Z',
    actualizadoEn: '2026-10-13T12:00:00.000Z',
  };

  it('exige autenticación', async () => {
    await request(app)
      .post('/api/sync')
      .send({ visitas: [visita] })
      .expect(401);
  });

  it('crea la visita la primera vez y la marca duplicada la segunda', async () => {
    const token = await tokenAdmin();

    const primero = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ visitas: [visita] })
      .expect(200);
    const cuerpoPrimero = cuerpoJson(primero) as {
      data: { aplicados: string[]; duplicados: string[] };
    };
    expect(cuerpoPrimero.data.aplicados).toEqual(['b1c2d3e4']);
    expect(cuerpoPrimero.data.duplicados).toEqual([]);

    const segundo = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ visitas: [visita] })
      .expect(200);
    const cuerpoSegundo = cuerpoJson(segundo) as {
      data: { aplicados: string[]; duplicados: string[] };
    };
    expect(cuerpoSegundo.data.aplicados).toEqual([]);
    expect(cuerpoSegundo.data.duplicados).toEqual(['b1c2d3e4']);
  });

  it('marca salida y deja de listarla entre las abiertas', async () => {
    const token = await tokenAdmin();
    await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        visitas: [
          {
            uuid: 'salida-1',
            tipo: 'ingreso',
            apellido: 'GOMEZ',
            nombre: 'ANA',
            dni: '27987654',
            entradaEn: '2026-10-13T13:00:00.000Z',
            actualizadoEn: '2026-10-13T13:00:00.000Z',
          },
        ],
      })
      .expect(200);

    const abiertas = await request(app)
      .get('/api/visits/abiertas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista = (cuerpoJson(abiertas) as { data: { id: string; uuid: string }[] }).data;
    const abierta = lista.find((v) => v.uuid === 'salida-1');
    expect(abierta).toBeDefined();

    await request(app)
      .post(`/api/visits/${String(abierta?.id)}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const despues = await request(app)
      .get('/api/visits/abiertas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const sigueAbierta = (cuerpoJson(despues) as { data: { uuid: string }[] }).data.some(
      (v) => v.uuid === 'salida-1',
    );
    expect(sigueAbierta).toBe(false);
  });
});
