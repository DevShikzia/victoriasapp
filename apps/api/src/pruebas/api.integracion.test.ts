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
    readonly usuario: {
      readonly usuario: string;
      readonly rol: string;
      readonly barrioId: string | null;
      readonly barrioNombre: string | null;
    };
  };
}

let mongo: MongoMemoryServer;
let env: Env;
let app: Express;
let idBarrio = '';

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

  // El admin elige su barrio una sola vez; el resto de las pruebas ya trabaja
  // con el directorio y las visitas acotadas a ese barrio.
  const token = await tokenAdmin();
  const eleccion = await request(app)
    .put('/api/auth/barrio')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'El Pare' })
    .expect(200);
  idBarrio = (cuerpoJson(eleccion) as CuerpoLogin).data.usuario.barrioId ?? '';
  expect(idBarrio).not.toBe('');
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

  it('lista los barrios disponibles para el primer ingreso', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .get('/api/auth/barrios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const barrios = (cuerpoJson(respuesta) as CuerpoData<{ id: string; nombre: string }[]>).data;
    expect(barrios.some((barrio) => barrio.id === idBarrio && barrio.nombre === 'El Pare')).toBe(
      true,
    );
  });

  it('no permite cambiar el barrio una vez elegido', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .put('/api/auth/barrio')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Otro barrio' })
      .expect(409);
    expect((cuerpoJson(respuesta) as { ok: boolean }).ok).toBe(false);
  });

  it('rechaza elegir barrio sin sesión', async () => {
    await request(app).put('/api/auth/barrio').send({ nombre: 'Sin sesión' }).expect(401);
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

  it('lista el estado activo, da de baja y reactiva', async () => {
    const token = await tokenAdmin();

    const alta = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuario: 'supervisor1',
        nombre: 'Super Uno',
        password: 'super12345',
        rol: 'supervisor',
      })
      .expect(201);
    const creado = (cuerpoJson(alta) as { data: { id: string; activo: boolean } }).data;
    expect(creado.activo).toBe(true);

    const activoDe = async (usuario: string): Promise<boolean | undefined> => {
      const listado = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const usuarios = (cuerpoJson(listado) as { data: { usuario: string; activo: boolean }[] })
        .data;
      return usuarios.find((u) => u.usuario === usuario)?.activo;
    };

    expect(await activoDe('supervisor1')).toBe(true);

    // DELETE es una baja lógica.
    await request(app)
      .delete(`/api/users/${creado.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(await activoDe('supervisor1')).toBe(false);

    // PATCH lo vuelve a activar.
    await request(app)
      .patch(`/api/users/${creado.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: true })
      .expect(200);
    expect(await activoDe('supervisor1')).toBe(true);
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
    'lote,propietario,telefono,patente,familiar,parentesco,descripcion,tratamiento',
    '42,"Perez, Juan",11-5555-5555,AB123CD,,,,señor',
    '42,"Gomez, Ana",11-6666-6666,AC456EF,Maria Perez,hija,Casa del fondo,señora',
  ].join('\n');

  async function tokenGuardia(): Promise<string> {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'guardia1', password: 'clave12345' })
      .expect(200);
    const tokenInicial = (cuerpoJson(login) as CuerpoLogin).data.accessToken;
    // El guardia también elige el barrio en su primer ingreso. Reintentarlo con
    // el mismo barrio es idempotente.
    const eleccion = await request(app)
      .put('/api/auth/barrio')
      .set('Authorization', `Bearer ${tokenInicial}`)
      .send({ barrioId: idBarrio })
      .expect(200);
    return (cuerpoJson(eleccion) as CuerpoLogin).data.accessToken;
  }

  it('rechaza el directorio si la cuenta todavía no eligió barrio', async () => {
    const token = await tokenAdmin();
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuario: 'sinbarrio',
        nombre: 'Sin Barrio',
        password: 'clave12345',
        rol: 'guardia',
      })
      .expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'sinbarrio', password: 'clave12345' })
      .expect(200);
    const tokenSinBarrio = (cuerpoJson(login) as CuerpoLogin).data.accessToken;

    const respuesta = await request(app)
      .get('/api/lotes')
      .set('Authorization', `Bearer ${tokenSinBarrio}`)
      .expect(400);
    const cuerpo = cuerpoJson(respuesta) as { error: { code: string } };
    expect(cuerpo.error.code).toBe('BARRIO_REQUERIDO');
  });

  it('importa el CSV creando lote, propietarios, vehículos y familiares', async () => {
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .post('/api/directorio/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ csv })
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
      .send({ csv })
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

    const juan = datos.propietarios.find((p) => p.nombre === 'Juan');
    const ana = datos.propietarios.find((p) => p.nombre === 'Ana');
    expect(juan?.tratamiento).toBe('senor');
    expect(ana?.tratamiento).toBe('senora');
    expect(ana?.loteNumero).toBe('42');

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
      .send({
        nombre: 'Carlos',
        apellido: 'Lopez',
        tratamiento: 'senor',
        telefono: '11-7777-7777',
      })
      .expect(201);
    const creadoData = (
      cuerpoJson(creado) as CuerpoData<{
        id: string;
        uuid: string;
        tratamiento: string | null;
      }>
    ).data;
    expect(creadoData.tratamiento).toBe('senor');

    const busqueda = await request(app)
      .get('/api/propietarios?q=lopez')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lista = (cuerpoJson(busqueda) as CuerpoData<{ apellido: string }[]>).data;
    expect(lista.some((p) => p.apellido === 'Lopez')).toBe(true);

    await request(app)
      .patch(`/api/propietarios/${creadoData.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '11-0000-0000', tratamiento: 'senora' })
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
    const lista = (cuerpoJson(respuesta) as CuerpoData<{ patente: string | null }[]>).data;
    expect(lista.some((v) => v.patente === 'AB123CD')).toBe(true);
  });

  it('refleja todos los propietarios de un lote ordenados por jerarquía', async () => {
    const token = await tokenAdmin();
    const loteResponse = await request(app)
      .post('/api/lotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero: '99', calle: 'Los Tilos' })
      .expect(201);
    const lote = (cuerpoJson(loteResponse) as CuerpoData<{ id: string }>).data;

    // La señora se crea primero para comprobar que el orden no depende del alta.
    const senoraResponse = await request(app)
      .post('/api/propietarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Marta',
        apellido: 'Suarez',
        tratamiento: 'senora',
        loteId: lote.id,
      })
      .expect(201);
    const senora = (cuerpoJson(senoraResponse) as CuerpoData<{ id: string }>).data;
    const senorResponse = await request(app)
      .post('/api/propietarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Raul',
        apellido: 'Suarez',
        tratamiento: 'senor',
        loteId: lote.id,
      })
      .expect(201);
    const senor = (cuerpoJson(senorResponse) as CuerpoData<{ id: string }>).data;

    const listado = await request(app)
      .get('/api/lotes?q=99')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lotes = (cuerpoJson(listado) as CuerpoData<{ id: string; propietarioId: string }[]>).data;
    expect(lotes.find((item) => item.id === lote.id)?.propietarioId).toBe(senor.id);
    expect(senora.id).not.toBe(senor.id);

    const pull = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(pull) as CuerpoData<DirectorioPull>).data;
    const loteLocal = datos.lotes.find((item) => item.numero === '99');
    expect(loteLocal?.propietarioNombre).toBe('Raul Suarez / Marta Suarez');
  });

  it('permite un vehículo sin patente y con varios usuarios del lote', async () => {
    const token = await tokenAdmin();
    const loteResponse = await request(app)
      .post('/api/lotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero: '100', calle: 'Los Tilos' })
      .expect(201);
    const lote = (cuerpoJson(loteResponse) as CuerpoData<{ id: string }>).data;
    const propietarioResponse = await request(app)
      .post('/api/propietarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Elena',
        apellido: 'Paz',
        tratamiento: 'senora',
        loteId: lote.id,
      })
      .expect(201);
    const propietario = (cuerpoJson(propietarioResponse) as CuerpoData<{ id: string }>).data;
    const familiarResponse = await request(app)
      .post('/api/familiares')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Tomas Paz', parentesco: 'hijo', propietarioId: propietario.id })
      .expect(201);
    const familiar = (cuerpoJson(familiarResponse) as CuerpoData<{ id: string }>).data;

    const creado = await request(app)
      .post('/api/vehiculos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patente: '',
        marca: 'Fiat',
        modelo: 'Cronos',
        loteId: lote.id,
        propietarioIds: [propietario.id],
        familiarIds: [familiar.id],
      })
      .expect(201);
    const vehiculo = (
      cuerpoJson(creado) as CuerpoData<{
        id: string;
        uuid: string;
        patente: string | null;
        propietarioIds: string[];
        familiarIds: string[];
      }>
    ).data;
    expect(vehiculo.patente).toBeNull();
    expect(vehiculo.propietarioIds).toEqual([propietario.id]);
    expect(vehiculo.familiarIds).toEqual([familiar.id]);

    // Otro vehículo sin patente: el índice único es parcial y no debe chocar.
    await request(app)
      .post('/api/vehiculos')
      .set('Authorization', `Bearer ${token}`)
      .send({ loteId: lote.id, marca: 'Renault', modelo: 'Kangoo' })
      .expect(201);

    const pull = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(pull) as CuerpoData<DirectorioPull>).data;
    const local = datos.vehiculos.find((item) => item.uuid === vehiculo.uuid);
    expect(local?.patente).toBeNull();
    expect(local?.loteNumero).toBe('100');
    expect(local?.usuariosNombres).toEqual(['Elena Paz', 'Tomas Paz']);
  });
});

describe('domésticas', () => {
  const DNI = '33444555';
  let principalUuid = '';
  let habitualUuid = '';
  let perfilUuid = '';

  async function tokenGuardia(): Promise<string> {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'guardia1', password: 'clave12345' })
      .expect(200);
    const tokenInicial = (cuerpoJson(login) as CuerpoLogin).data.accessToken;
    const eleccion = await request(app)
      .put('/api/auth/barrio')
      .set('Authorization', `Bearer ${tokenInicial}`)
      .send({ barrioId: idBarrio })
      .expect(200);
    return (cuerpoJson(eleccion) as CuerpoLogin).data.accessToken;
  }

  /** Reutiliza los lotes del directorio y crea uno nuevo para "habitual". */
  async function prepararLotes(): Promise<void> {
    if (principalUuid !== '' && habitualUuid !== '') {
      return;
    }
    const token = await tokenAdmin();
    const pull = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const principal = (cuerpoJson(pull) as CuerpoData<DirectorioPull>).data.lotes.find(
      (lote) => lote.numero === '42',
    );
    expect(principal).toBeDefined();

    const creado = await request(app)
      .post('/api/lotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero: '77', calle: 'Los Álamos' })
      .expect(201);
    const lote = (cuerpoJson(creado) as CuerpoData<{ uuid: string }>).data;

    principalUuid = principal?.uuid ?? '';
    habitualUuid = lote.uuid;
  }

  async function asegurarPerfil(): Promise<string> {
    if (perfilUuid !== '') {
      return perfilUuid;
    }
    await prepararLotes();
    const token = await tokenAdmin();
    const creado = await request(app)
      .post('/api/domesticas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Rosa',
        apellido: 'Molina',
        dni: DNI,
        telefono: '11-4444-4444',
        lotePrincipalUuid: principalUuid,
        lotesHabituales: [habitualUuid],
        notas: 'Limpia los martes',
      })
      .expect(201);
    const perfil = (
      cuerpoJson(creado) as CuerpoData<{
        uuid: string;
        lotePrincipalUuid: string | null;
        lotesHabituales: string[];
      }>
    ).data;
    expect(perfil.lotePrincipalUuid).toBe(principalUuid);
    expect(perfil.lotesHabituales).toEqual([habitualUuid]);
    perfilUuid = perfil.uuid;
    return perfilUuid;
  }

  it('un admin crea el perfil y el pull del directorio lo incluye', async () => {
    const uuid = await asegurarPerfil();
    const token = await tokenAdmin();

    const pull = await request(app)
      .get('/api/directorio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const datos = (cuerpoJson(pull) as CuerpoData<DirectorioPull>).data;
    const local = datos.domesticas.find((domestica) => domestica.uuid === uuid);
    expect(local?.dni).toBe(DNI);
    expect(local?.lotePrincipalUuid).toBe(principalUuid);
    expect(local?.lotesHabituales).toEqual([habitualUuid]);
  });

  it('no permite dos perfiles con el mismo DNI en el barrio', async () => {
    await asegurarPerfil();
    await prepararLotes();
    const token = await tokenAdmin();
    const respuesta = await request(app)
      .post('/api/domesticas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Otra',
        apellido: 'Persona',
        dni: DNI,
        lotePrincipalUuid: habitualUuid,
      })
      .expect(409);
    const cuerpo = cuerpoJson(respuesta) as { error: { code: string } };
    expect(cuerpo.error.code).toBe('CONFLICT');
  });

  it('un guardia no puede crear, editar ni desactivar perfiles (403)', async () => {
    await prepararLotes();
    const token = await tokenGuardia();
    const cuerpo = {
      nombre: 'No',
      apellido: 'Permitido',
      dni: '30999888',
      lotePrincipalUuid: principalUuid,
    };
    await request(app)
      .post('/api/domesticas')
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo)
      .expect(403);
    await request(app)
      .patch(`/api/domesticas/${perfilUuid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Cambio' })
      .expect(403);
    await request(app)
      .delete(`/api/domesticas/${perfilUuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('registra entrada y salida por sync, sin duplicar ni abrir dos veces', async () => {
    const domesticaUuid = await asegurarPerfil();
    const token = await tokenGuardia();
    const entrada = {
      uuid: 'dom-entrada-1',
      domesticaUuid,
      loteUuid: habitualUuid,
      entradaEn: '2026-10-20T11:00:00.000Z',
      salidaEn: null,
      descripcion: 'Limpieza',
      actualizadoEn: '2026-10-20T11:00:00.000Z',
    };

    const primero = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ registrosDomesticas: [entrada] })
      .expect(200);
    const resultadoPrimero = (
      cuerpoJson(primero) as CuerpoData<{ aplicados: string[]; errores: unknown[] }>
    ).data;
    expect(resultadoPrimero.aplicados).toEqual(['dom-entrada-1']);
    expect(resultadoPrimero.errores).toHaveLength(0);

    // Reenviar lo mismo es idempotente.
    const reenvio = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ registrosDomesticas: [entrada] })
      .expect(200);
    expect((cuerpoJson(reenvio) as CuerpoData<{ duplicados: string[] }>).data.duplicados).toEqual([
      'dom-entrada-1',
    ]);

    // Otra entrada abierta con distinto uuid debe rechazarse.
    const segundaAbierta = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        registrosDomesticas: [
          {
            ...entrada,
            uuid: 'dom-entrada-2',
            entradaEn: '2026-10-20T15:00:00.000Z',
            actualizadoEn: '2026-10-20T15:00:00.000Z',
          },
        ],
      })
      .expect(200);
    const errores = (
      cuerpoJson(segundaAbierta) as CuerpoData<{ errores: { uuid: string; mensaje: string }[] }>
    ).data.errores;
    expect(errores).toEqual([
      { uuid: 'dom-entrada-2', mensaje: 'La doméstica ya tiene una entrada abierta' },
    ]);

    const dentro = await request(app)
      .get('/api/domesticas/registros?estado=dentro')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const abiertos = (cuerpoJson(dentro) as CuerpoData<{ uuid: string }[]>).data;
    expect(abiertos.map((registro) => registro.uuid)).toEqual(['dom-entrada-1']);

    const salida = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        registrosDomesticas: [
          {
            ...entrada,
            salidaEn: '2026-10-20T17:30:00.000Z',
            descripcion: 'Limpieza y planchado',
            actualizadoEn: '2026-10-20T17:30:00.000Z',
          },
        ],
      })
      .expect(200);
    const resultadoSalida = (
      cuerpoJson(salida) as CuerpoData<{ aplicados: string[]; errores: unknown[] }>
    ).data;
    expect(resultadoSalida.aplicados).toEqual(['dom-entrada-1']);
    expect(resultadoSalida.errores).toHaveLength(0);

    const dentroDespues = await request(app)
      .get('/api/domesticas/registros?estado=dentro')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((cuerpoJson(dentroDespues) as CuerpoData<unknown[]>).data).toHaveLength(0);

    const fuera = await request(app)
      .get(`/api/domesticas/registros?estado=fuera&domestica=${domesticaUuid}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const cerrados = (
      cuerpoJson(fuera) as CuerpoData<{ uuid: string; salidaEn: string | null }[]>
    ).data;
    expect(cerrados).toHaveLength(1);
    expect(cerrados[0]?.uuid).toBe('dom-entrada-1');
    expect(cerrados[0]?.salidaEn).toBe('2026-10-20T17:30:00.000Z');
  });

  it('aísla los perfiles y registros entre barrios', async () => {
    const domesticaUuid = await asegurarPerfil();
    const tokenAdminActual = await tokenAdmin();

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenAdminActual}`)
      .send({
        usuario: 'guardia-barrio-2',
        nombre: 'Guardia Dos',
        password: 'clave12345',
        rol: 'guardia',
      })
      .expect(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ usuario: 'guardia-barrio-2', password: 'clave12345' })
      .expect(200);
    const tokenInicial = (cuerpoJson(login) as CuerpoLogin).data.accessToken;
    const eleccion = await request(app)
      .put('/api/auth/barrio')
      .set('Authorization', `Bearer ${tokenInicial}`)
      .send({ nombre: 'Barrio Vecino' })
      .expect(200);
    const tokenOtroBarrio = (cuerpoJson(eleccion) as CuerpoLogin).data.accessToken;

    const listado = await request(app)
      .get('/api/domesticas')
      .set('Authorization', `Bearer ${tokenOtroBarrio}`)
      .expect(200);
    expect((cuerpoJson(listado) as CuerpoData<unknown[]>).data).toHaveLength(0);

    const sync = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${tokenOtroBarrio}`)
      .send({
        registrosDomesticas: [
          {
            uuid: 'dom-ajeno-1',
            domesticaUuid,
            loteUuid: habitualUuid,
            entradaEn: '2026-10-21T11:00:00.000Z',
            salidaEn: null,
            actualizadoEn: '2026-10-21T11:00:00.000Z',
          },
        ],
      })
      .expect(200);
    const resultado = (
      cuerpoJson(sync) as CuerpoData<{ errores: { uuid: string; mensaje: string }[] }>
    ).data;
    expect(resultado.errores).toEqual([
      { uuid: 'dom-ajeno-1', mensaje: 'La doméstica no existe en este barrio' },
    ]);
  });
});
