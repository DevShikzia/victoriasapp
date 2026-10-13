import type { Express } from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../app.js';
import { cargarEnv, type Env } from '../config/env.js';
import { conectarMongo } from '../db/conexion.js';
import { PropietarioModel } from '../models/directorio.modelos.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { asegurarAdminDesdeEnv } from '../servicios/admin.bootstrap.js';
import type { DirectorioPull } from '@victoriasapp/shared';

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

describe('histórico de visitas (filtros)', () => {
  const abierta = {
    uuid: 'hist-abierta',
    tipo: 'ingreso',
    apellido: 'HISTORICA',
    nombre: 'ABIERTA',
    dni: '11111111',
    patente: 'HIST001',
    loteNumero: 'H1',
    entradaEn: '2026-05-01T10:00:00.000Z',
    actualizadoEn: '2026-05-01T10:00:00.000Z',
  };
  const cerrada = {
    uuid: 'hist-cerrada',
    tipo: 'ingreso',
    apellido: 'HISTORICA',
    nombre: 'CERRADA',
    dni: '22222222',
    patente: 'HIST002',
    loteNumero: 'H2',
    entradaEn: '2026-05-02T15:00:00.000Z',
    actualizadoEn: '2026-05-02T15:00:00.000Z',
  };

  beforeAll(async () => {
    const token = await tokenAdmin();
    await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ visitas: [abierta, cerrada] })
      .expect(200);

    const listado = await request(app)
      .get('/api/visits?q=HISTORICA')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const docs = (cuerpoJson(listado) as CuerpoData<{ id: string; uuid: string }[]>).data;
    const doc = docs.find((v) => v.uuid === 'hist-cerrada');
    await request(app)
      .post(`/api/visits/${String(doc?.id)}/salida`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  async function buscar(query: string): Promise<readonly string[]> {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .get(`/api/visits${query}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (cuerpoJson(respuesta) as CuerpoData<{ uuid: string }[]>).data.map((v) => v.uuid);
  }

  it('busca por texto libre sin distinguir mayúsculas', async () => {
    const uuids = await buscar('?q=historica');
    expect(uuids).toContain('hist-abierta');
    expect(uuids).toContain('hist-cerrada');
  });

  it('busca por nombre, DNI, patente y lote', async () => {
    expect(await buscar('?q=ABIERTA')).toContain('hist-abierta');
    expect(await buscar('?dni=22222222')).toContain('hist-cerrada');
    expect(await buscar('?patente=hist002')).toContain('hist-cerrada');
    expect(await buscar('?lote=H1')).toContain('hist-abierta');
  });

  it('filtra por estado dentro/fuera', async () => {
    const dentro = await buscar('?q=historica&estado=dentro');
    expect(dentro).toContain('hist-abierta');
    expect(dentro).not.toContain('hist-cerrada');

    const fuera = await buscar('?q=historica&estado=fuera');
    expect(fuera).toContain('hist-cerrada');
    expect(fuera).not.toContain('hist-abierta');
  });

  it('filtra por rango de fechas de entrada', async () => {
    const rango = await buscar(
      '?q=historica&desde=2026-05-02T00:00:00.000Z&hasta=2026-05-03T00:00:00.000Z',
    );
    expect(rango).toContain('hist-cerrada');
    expect(rango).not.toContain('hist-abierta');
  });

  it('trata el texto de búsqueda como literal (no como regex)', async () => {
    expect(await buscar('?q=.*')).toHaveLength(0);
  });
});

interface CuerpoData<T> {
  readonly ok: boolean;
  readonly data: T;
}

describe('directorio', () => {
  const csv = [
    'lote,propietario,telefono,patente,familiar,parentesco,descripcion',
    '42,"Perez, Juan",11-5555-5555,AB123CD,,,',
    '42,"Gomez, Ana",11-6666-6666,AC456EF,Maria Perez,hija,Casa del fondo',
  ].join('\n');

  async function tokenGuardia(): Promise<string> {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'guardia1', password: 'clave12345' })
      .expect(200);
    return (cuerpoJson(login) as CuerpoLogin).data.accessToken;
  }

  it('importa el CSV creando barrio, lote, propietarios, vehículos y familiares', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .post('/api/directorio/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ barrio: 'El Pare', csv })
      .expect(200);
    const datos = (cuerpoJson(respuesta) as CuerpoData<{ creados: number; errores: unknown[] }>)
      .data;
    expect(datos.creados).toBe(2);
    expect(datos.errores).toHaveLength(0);
  });

  it('es idempotente: reimportar actualiza sin duplicar', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .post('/api/directorio/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ barrio: 'El Pare', csv })
      .expect(200);
    const datos = (cuerpoJson(respuesta) as CuerpoData<{ creados: number; actualizados: number }>)
      .data;
    expect(datos.creados).toBe(0);
    expect(datos.actualizados).toBe(2);
    expect(await PropietarioModel.countDocuments({})).toBe(2);
  });

  it('el pull devuelve las proyecciones con los nombres resueltos', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(respuesta) as CuerpoData<DirectorioPull>).data;

    const lote = datos.lotes.find((l) => l.numero === '42');
    expect(lote?.propietarioNombre).toContain('Juan Perez');
    expect(lote?.propietarioNombre).toContain('Ana Gomez');

    const vehiculo = datos.vehiculos.find((v) => v.patente === 'AB123CD');
    expect(vehiculo?.loteNumero).toBe('42');
    expect(vehiculo?.propietarioNombre).toBe('Juan Perez');

    const familiar = datos.familiares.find((f) => f.nombre === 'Maria Perez');
    expect(familiar?.propietarioNombre).toBe('Ana Gomez');
    expect(familiar?.loteNumero).toBe('42');
  });

  it('el pull incremental no repite lo ya visto', async () => {
    const token = await tokenAdmin();
    const primero = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const desde = (cuerpoJson(primero) as CuerpoData<DirectorioPull>).data.desde;

    const segundo = await request(app)
      .get(`/api/directorio?desde=${encodeURIComponent(desde)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(segundo) as CuerpoData<DirectorioPull>).data;
    expect(datos.lotes).toHaveLength(0);
    expect(datos.propietarios).toHaveLength(0);
    expect(datos.vehiculos).toHaveLength(0);
  });

  it('un guardia puede leer pero no importar (403)', async () => {
    const token = await tokenGuardia();
    await request(app).get('/api/directorio').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app)
      .post('/api/directorio/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ csv })
      .expect(403);
  });

  it('ABM de propietarios: crea, busca, edita y borra dejando lápida', async () => {
    const token = await tokenAdmin();
    const base = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const desde = (cuerpoJson(base) as CuerpoData<DirectorioPull>).data.desde;

    const creado = await request(app)
      .post('/api/propietarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Carlos', apellido: 'Lopez', telefono: '11-7777-7777' })
      .expect(201);
    const creadoData = (cuerpoJson(creado) as CuerpoData<{ id: string; uuid: string }>).data;

    const busqueda = await request(app)
      .get('/api/propietarios?q=lopez')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista = (cuerpoJson(busqueda) as CuerpoData<{ apellido: string }[]>).data;
    expect(lista.some((p) => p.apellido === 'Lopez')).toBe(true);

    await request(app)
      .patch(`/api/propietarios/${creadoData.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '11-0000-0000' })
      .expect(200);

    await request(app)
      .delete(`/api/propietarios/${creadoData.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const despues = await request(app)
      .get(`/api/directorio?desde=${encodeURIComponent(desde)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(despues) as CuerpoData<DirectorioPull>).data;
    expect(datos.eliminados).toContainEqual({
      entidad: 'propietario',
      uuid: creadoData.uuid,
    });
  });

  it('busca vehículos por patente', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .get('/api/vehiculos?patente=ab123cd')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista = (cuerpoJson(respuesta) as CuerpoData<{ patente: string }[]>).data;
    expect(lista.some((v) => v.patente === 'AB123CD')).toBe(true);
  });
});
