import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { AutorizacionesVencimientoService } from '@Autorizaciones/services';
import { PrismaService } from '@Prisma/services';
import { EstadoAutorizacion, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import { crearAutorizacion, crearTorre, crearUnidad, crearUsuario, limpiarTablas, login } from './helpers/fixtures.js';

const URL = '/api/v1/autorizaciones';
const MSG_FECHA = 'Elige una fecha entre hoy y los próximos 30 días';
const MSG_DOC = 'El número de documento no tiene el formato correcto';

describe('Autorizaciones de visita (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const hoy = () => hoyEnZonaNegocio();

  const auth = (req: request.Test, token: string | null) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  const post = (token: string | null, body: object) => auth(request(app.getHttpServer()).post(URL).send(body), token);
  const mias = (token: string | null) => auth(request(app.getHttpServer()).get(`${URL}/mias`), token);
  const cancelar = (token: string | null, id: string) =>
    auth(request(app.getHttpServer()).patch(`${URL}/${id}/cancelar`), token);

  const valido = (extra: object = {}) => ({
    nombre: 'María López',
    tipoDocumento: 'DUI',
    numeroDocumento: '01234567-8',
    fechaVisita: sumarDias(hoy(), 1),
    horaEstimada: '14:30',
    ...extra,
  });

  // Dos residentes (uno con una unidad, otro con dos), y un administrador.
  async function escenario() {
    const torre = await crearTorre(prisma);
    const a101 = await crearUnidad(prisma, torre.id, 'A-101');
    const a102 = await crearUnidad(prisma, torre.id, 'A-102');
    const b205 = await crearUnidad(prisma, torre.id, 'B-205');
    const r1 = await crearUsuario(prisma, 'r1@test.com', {
      unidadIds: [a101.id],
    });
    const r2 = await crearUsuario(prisma, 'r2@test.com', {
      unidadIds: [a102.id, b205.id],
    });
    await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
    return {
      a101,
      a102,
      b205,
      r1,
      r2,
      t1: await login(app, 'r1@test.com'),
      t2: await login(app, 'r2@test.com'),
      tAdmin: await login(app, 'admin@test.com'),
    };
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limpiarTablas(prisma);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /autorizaciones', () => {
    it('crea una válida: 201, código de 6 dígitos, VIGENTE y forma completa', async () => {
      const { t1, a101, r1 } = await escenario();
      const res = await post(t1, valido({ placa: ' p123-456 ' })).expect(201);
      expect(res.body).toMatchObject({
        nombre: 'María López',
        tipoDocumento: 'DUI',
        numeroDocumento: '01234567-8',
        placa: 'P123-456',
        fechaVisita: sumarDias(hoy(), 1),
        horaEstimada: '14:30',
        estado: 'VIGENTE',
        unidad: { id: a101.id, codigo: 'A-101' },
      });
      expect(res.body.codigo).toMatch(/^\d{6}$/);
      const fila = await prisma.autorizacionVisita.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(fila.residenteId).toBe(r1.id);
    });

    it('acepta hoy aunque la hora ya pasó, y hoy+30', async () => {
      const { t1 } = await escenario();
      await post(t1, valido({ fechaVisita: hoy(), horaEstimada: '00:00' })).expect(201);
      await post(t1, valido({ fechaVisita: sumarDias(hoy(), 30) })).expect(201);
    });

    it('ayer y hoy+31 -> 400 con el mensaje exacto', async () => {
      const { t1 } = await escenario();
      for (const f of [sumarDias(hoy(), -1), sumarDias(hoy(), 31)]) {
        const res = await post(t1, valido({ fechaVisita: f })).expect(400);
        expect(res.body.message).toContain(MSG_FECHA);
      }
    });

    it('DUI y pasaporte mal formados -> 400 con el mensaje exacto; pasaporte en minúsculas se normaliza', async () => {
      const { t1 } = await escenario();
      let res = await post(t1, valido({ numeroDocumento: '012345678' })).expect(400);
      expect(res.body.message).toContain(MSG_DOC);
      res = await post(t1, valido({ tipoDocumento: 'PASAPORTE', numeroDocumento: 'ab12' })).expect(400);
      expect(res.body.message).toContain(MSG_DOC);
      res = await post(t1, valido({ tipoDocumento: 'PASAPORTE', numeroDocumento: 'ab123456' })).expect(201);
      expect(res.body.numeroDocumento).toBe('AB123456');
    });

    it('ignora/rechaza residenteId en el body (forbidNonWhitelisted)', async () => {
      const { t1, r2 } = await escenario();
      await post(t1, valido({ residenteId: r2.id })).expect(400);
    });

    it('unidad ajena o inexistente -> 403; varias unidades sin unidadId -> 400', async () => {
      const { t1, t2, a101, b205 } = await escenario();
      const ajena = await post(t1, valido({ unidadId: b205.id })).expect(403);
      expect(ajena.body.message).toBe('No tienes permiso para esta acción');
      await post(t1, valido({ unidadId: '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55' })).expect(403);
      await post(t2, valido({ unidadId: a101.id })).expect(403);
      const sin = await post(t2, valido()).expect(400);
      expect(sin.body.message).toBe('Selecciona una unidad');
      const ok = await post(t2, valido({ unidadId: b205.id })).expect(201);
      expect(ok.body.unidad.codigo).toBe('B-205');
    });

    it('usuario sin unidades -> 400', async () => {
      await crearUsuario(prisma, 'solo@test.com');
      const t = await login(app, 'solo@test.com');
      const res = await post(t, valido()).expect(400);
      expect(res.body.message).toBe('No tienes unidades asignadas');
    });

    it('ADMINISTRADOR -> 403 y sin token -> 401', async () => {
      const { tAdmin } = await escenario();
      await post(tAdmin, valido()).expect(403);
      await post(null, valido()).expect(401);
    });
  });

  describe('GET /autorizaciones/mias', () => {
    it('solo trae las propias (todas sus unidades), ordenadas por fecha y hora', async () => {
      const { t2, r1, r2, a101, a102, b205 } = await escenario();
      const f = (n: number) => sumarDias(hoy(), n);
      await crearAutorizacion(prisma, {
        unidadId: a101.id,
        residenteId: r1.id,
        codigo: '111111',
        fechaVisita: f(1),
      });
      await crearAutorizacion(prisma, {
        unidadId: a102.id,
        residenteId: r2.id,
        codigo: '222222',
        fechaVisita: f(3),
        horaEstimada: '09:00',
      });
      await crearAutorizacion(prisma, {
        unidadId: b205.id,
        residenteId: r2.id,
        codigo: '333333',
        fechaVisita: f(2),
      });
      await crearAutorizacion(prisma, {
        unidadId: a102.id,
        residenteId: r2.id,
        codigo: '444444',
        fechaVisita: f(3),
        horaEstimada: '08:00',
      });

      const res = await mias(t2).expect(200);
      expect(res.body.datos.map((a: { codigo: string }) => a.codigo)).toEqual(['333333', '444444', '222222']);
      expect(res.body.datos[0].unidad.codigo).toBe('B-205');
    });

    it('401 sin token y 403 para ADMINISTRADOR', async () => {
      const { tAdmin } = await escenario();
      await mias(null).expect(401);
      await mias(tAdmin).expect(403);
    });
  });

  describe('PATCH /autorizaciones/:id/cancelar', () => {
    it('cancela una vigente (200 CANCELADA) y la segunda vez da 409', async () => {
      const { t1, r1, a101 } = await escenario();
      const a = await crearAutorizacion(prisma, {
        unidadId: a101.id,
        residenteId: r1.id,
        codigo: '111111',
        fechaVisita: sumarDias(hoy(), 1),
      });
      const res = await cancelar(t1, a.id).expect(200);
      expect(res.body).toMatchObject({
        id: a.id,
        estado: 'CANCELADA',
        unidad: { codigo: 'A-101' },
      });
      const otra = await cancelar(t1, a.id).expect(409);
      expect(otra.body.message).toBe('Esta autorización ya no se puede cancelar');
    });

    it('USADA y VENCIDA -> 409 con el mensaje exacto', async () => {
      const { t1, r1, a101 } = await escenario();
      for (const [codigo, estado] of [
        ['111111', EstadoAutorizacion.USADA],
        ['222222', EstadoAutorizacion.VENCIDA],
      ] as const) {
        const a = await crearAutorizacion(prisma, {
          unidadId: a101.id,
          residenteId: r1.id,
          codigo,
          fechaVisita: hoy(),
          estado,
        });
        const res = await cancelar(t1, a.id).expect(409);
        expect(res.body.message).toBe('Esta autorización ya no se puede cancelar');
      }
    });

    it('de otro residente o inexistente -> 404; id no uuid -> 400', async () => {
      const { t2, r1, a101 } = await escenario();
      const a = await crearAutorizacion(prisma, {
        unidadId: a101.id,
        residenteId: r1.id,
        codigo: '111111',
        fechaVisita: sumarDias(hoy(), 1),
      });
      const res = await cancelar(t2, a.id).expect(404);
      expect(res.body.message).toBe('La autorización no existe');
      await cancelar(t2, '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55').expect(404);
      await cancelar(t2, 'no-es-uuid').expect(400);
      expect(
        (
          await prisma.autorizacionVisita.findUniqueOrThrow({
            where: { id: a.id },
          })
        ).estado,
      ).toBe('VIGENTE');
    });

    it('401 sin token y 403 para ADMINISTRADOR', async () => {
      const { tAdmin } = await escenario();
      const id = '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55';
      await cancelar(null, id).expect(401);
      await cancelar(tAdmin, id).expect(403);
    });
  });

  describe('tarea de vencimiento', () => {
    it('vence las de hoy y ayer, no las de mañana; la segunda corrida da 0', async () => {
      const { r1, a101 } = await escenario();
      const mk = (codigo: string, dias: number, estado?: EstadoAutorizacion) =>
        crearAutorizacion(prisma, {
          unidadId: a101.id,
          residenteId: r1.id,
          codigo,
          fechaVisita: sumarDias(hoy(), dias),
          estado,
        });
      const ayer = await mk('111111', -1);
      const hoyA = await mk('222222', 0);
      const manana = await mk('333333', 1);
      const cancelada = await mk('444444', 0, EstadoAutorizacion.CANCELADA);

      const tarea = app.get(AutorizacionesVencimientoService);
      expect(await tarea.marcarVencidas()).toBe(2);
      const estado = async (id: string) =>
        (await prisma.autorizacionVisita.findUniqueOrThrow({ where: { id } })).estado;
      expect(await estado(ayer.id)).toBe('VENCIDA');
      expect(await estado(hoyA.id)).toBe('VENCIDA');
      expect(await estado(manana.id)).toBe('VIGENTE');
      expect(await estado(cancelada.id)).toBe('CANCELADA');
      expect(await tarea.marcarVencidas()).toBe(0);
    });
  });

  describe('GET /unidades/mias', () => {
    it('devuelve las unidades del usuario ordenadas por código', async () => {
      const { t2, t1, tAdmin } = await escenario();
      const res = await request(app.getHttpServer())
        .get('/api/v1/unidades/mias')
        .set('Authorization', `Bearer ${t2}`)
        .expect(200);
      expect(res.body.map((u: { codigo: string }) => u.codigo)).toEqual(['A-102', 'B-205']);
      expect(Object.keys(res.body[0]).sort()).toEqual(['codigo', 'id']);
      await request(app.getHttpServer()).get('/api/v1/unidades/mias').set('Authorization', `Bearer ${t1}`).expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/unidades/mias')
        .set('Authorization', `Bearer ${tAdmin}`)
        .expect(403);
      await request(app.getHttpServer()).get('/api/v1/unidades/mias').expect(401);
    });
  });
});
