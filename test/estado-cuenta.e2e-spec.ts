import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CuotasVencimientoService } from '@EstadoCuenta/services';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, Rol } from '@PrismaClient';
import { crearApp } from './helpers/app.js';
import {
  crearCuota,
  crearTorre,
  crearUnidad,
  crearUsuario,
  limpiarTablas,
  login,
} from './helpers/fixtures.js';

const URL = '/api/v1/estado-cuenta';

/** Suma `dias` a una fecha YYYY-MM-DD (aritmética en UTC, sin husos). */
const sumarDias = (iso: string, dias: number) =>
  new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/** Periodos YYYY-MM consecutivos desde 2024-01. */
const periodo = (i: number) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

describe('GET /estado-cuenta (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (token: string | null, query: Record<string, string | number> = {}) => {
    const req = request(app.getHttpServer()).get(URL).query(query);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  // Escenario base: un residente con una unidad.
  async function escenarioBasico() {
    const torre = await crearTorre(prisma);
    const unidad = await crearUnidad(prisma, torre.id, 'A-101');
    await crearUsuario(prisma, 'res@test.com', { unidadIds: [unidad.id] });
    return { unidad, token: await login(app, 'res@test.com') };
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

  it('pagina 25 cuotas en 20 + 5, orden periodo desc y forma de cada fila', async () => {
    const { unidad, token } = await escenarioBasico();
    for (let i = 0; i < 25; i++) {
      await crearCuota(prisma, {
        unidadId: unidad.id,
        periodo: periodo(i),
        monto: 45,
        fechaVencimiento: `${periodo(i)}-10`,
      });
    }

    const p1 = await get(token).expect(200);
    expect(p1.body.datos).toHaveLength(20);
    expect(p1.body).toMatchObject({ total: 25, pagina: 1, porPagina: 20 });
    const periodos: string[] = p1.body.datos.map((c: { periodo: string }) => c.periodo);
    expect(periodos).toEqual([...periodos].sort().reverse());
    expect(periodos[0]).toBe(periodo(24));
    expect(p1.body.datos[0]).toEqual({
      id: expect.any(String),
      periodo: periodo(24),
      monto: 45,
      fechaVencimiento: `${periodo(24)}-10`,
      estado: 'PENDIENTE',
    });

    const p2 = await get(token, { pagina: 2 }).expect(200);
    expect(p2.body.datos).toHaveLength(5);
    expect(p2.body.pagina).toBe(2);
    expect(p2.body.datos[4].periodo).toBe(periodo(0));
  });

  it('saldoTotal suma PENDIENTE+VENCIDA con centavos, excluye PAGADA y no cambia con filtros', async () => {
    const { unidad, token } = await escenarioBasico();
    await crearCuota(prisma, { unidadId: unidad.id, periodo: '2026-01', monto: '45.10', fechaVencimiento: '2026-01-10', estado: EstadoCuota.PENDIENTE });
    await crearCuota(prisma, { unidadId: unidad.id, periodo: '2026-02', monto: '30.25', fechaVencimiento: '2026-02-10', estado: EstadoCuota.VENCIDA });
    await crearCuota(prisma, { unidadId: unidad.id, periodo: '2026-03', monto: '99.99', fechaVencimiento: '2026-03-10', estado: EstadoCuota.PAGADA });

    const todas = await get(token).expect(200);
    expect(todas.body.saldoTotal).toBe(75.35);

    const pagadas = await get(token, { estado: 'PAGADA' }).expect(200);
    expect(pagadas.body.saldoTotal).toBe(75.35);
    expect(pagadas.body.total).toBe(1);
    expect(pagadas.body.datos[0].monto).toBe(99.99);
  });

  it('marcarVencidas pasa a VENCIDA solo la vencida ayer y es idempotente', async () => {
    const { unidad } = await escenarioBasico();
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/El_Salvador',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const base = { unidadId: unidad.id, monto: 10 };
    const ayer = await crearCuota(prisma, { ...base, periodo: '2030-01', fechaVencimiento: sumarDias(hoy, -1) });
    const hoyC = await crearCuota(prisma, { ...base, periodo: '2030-02', fechaVencimiento: hoy });
    const manana = await crearCuota(prisma, { ...base, periodo: '2030-03', fechaVencimiento: sumarDias(hoy, 1) });
    const pagada = await crearCuota(prisma, { ...base, periodo: '2030-04', fechaVencimiento: sumarDias(hoy, -5), estado: EstadoCuota.PAGADA });

    // Se invoca el método directamente: los e2e no esperan al reloj del @Cron.
    const servicio = app.get(CuotasVencimientoService);
    expect(await servicio.marcarVencidas()).toBe(1);
    expect(await servicio.marcarVencidas()).toBe(0);

    const estado = async (id: string) => (await prisma.cuota.findUniqueOrThrow({ where: { id } })).estado;
    expect(await estado(ayer.id)).toBe('VENCIDA');
    expect(await estado(hoyC.id)).toBe('PENDIENTE');
    expect(await estado(manana.id)).toBe('PENDIENTE');
    expect(await estado(pagada.id)).toBe('PAGADA');
  });

  describe('filtros', () => {
    let token: string;

    beforeEach(async () => {
      const esc = await escenarioBasico();
      token = esc.token;
      await crearCuota(prisma, { unidadId: esc.unidad.id, periodo: '2026-01', monto: 10, fechaVencimiento: '2026-01-10', estado: EstadoCuota.PAGADA });
      await crearCuota(prisma, { unidadId: esc.unidad.id, periodo: '2026-02', monto: 10, fechaVencimiento: '2026-02-10', estado: EstadoCuota.VENCIDA });
      await crearCuota(prisma, { unidadId: esc.unidad.id, periodo: '2026-03', monto: 10, fechaVencimiento: '2026-03-10', estado: EstadoCuota.PENDIENTE });
    });

    it('filtra por estado', async () => {
      const r = await get(token, { estado: 'VENCIDA' }).expect(200);
      expect(r.body.datos.map((c: { periodo: string }) => c.periodo)).toEqual(['2026-02']);
    });

    it('el rango desde/hasta es inclusive', async () => {
      const r = await get(token, { desde: '2026-01-10', hasta: '2026-02-10' }).expect(200);
      expect(r.body.datos.map((c: { periodo: string }) => c.periodo)).toEqual(['2026-02', '2026-01']);
      expect(r.body.total).toBe(2);
    });

    it('un filtro sin resultados responde 200 con datos vacíos', async () => {
      const r = await get(token, { desde: '2027-01-01' }).expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.total).toBe(0);
    });

    it('desde > hasta, fecha imposible y estado inválido responden 400', async () => {
      const r = await get(token, { desde: '2026-12-01', hasta: '2026-01-01' }).expect(400);
      expect(JSON.stringify(r.body.message)).toContain('La fecha desde no puede ser mayor que la fecha hasta');
      const f = await get(token, { desde: '2026-02-31' }).expect(400);
      expect(JSON.stringify(f.body.message)).toContain('La fecha desde no es una fecha válida');
      await get(token, { hasta: '2026-02-29' }).expect(400);
      await get(token, { desde: '2028-02-29' }).expect(200);
      await get(token, { estado: 'XYZ' }).expect(400);
      await get(token, { pagina: 0 }).expect(400);
    });
  });

  describe('permisos', () => {
    it('sin unidadId usa la primera por código y lista ambas unidades', async () => {
      const torre = await crearTorre(prisma);
      const b = await crearUnidad(prisma, torre.id, 'B-205');
      const a = await crearUnidad(prisma, torre.id, 'A-101');
      await crearUsuario(prisma, 'dos@test.com', { unidadIds: [b.id, a.id] });
      await crearCuota(prisma, { unidadId: a.id, periodo: '2026-01', monto: 10, fechaVencimiento: '2026-01-10' });
      await crearCuota(prisma, { unidadId: b.id, periodo: '2026-01', monto: 20, fechaVencimiento: '2026-01-10' });
      const token = await login(app, 'dos@test.com');

      const def = await get(token).expect(200);
      expect(def.body.unidad.codigo).toBe('A-101');
      expect(def.body.unidades.map((u: { codigo: string }) => u.codigo)).toEqual(['A-101', 'B-205']);
      expect(def.body.saldoTotal).toBe(10);

      const propia = await get(token, { unidadId: b.id }).expect(200);
      expect(propia.body.unidad.codigo).toBe('B-205');
      expect(propia.body.saldoTotal).toBe(20);
    });

    it('unidad de otro residente o inexistente responde 403 sin datos', async () => {
      const torre = await crearTorre(prisma);
      const mia = await crearUnidad(prisma, torre.id, 'A-101');
      const ajena = await crearUnidad(prisma, torre.id, 'A-102');
      await crearUsuario(prisma, 'yo@test.com', { unidadIds: [mia.id] });
      await crearUsuario(prisma, 'otro@test.com', { unidadIds: [ajena.id] });
      await crearCuota(prisma, { unidadId: ajena.id, periodo: '2026-01', monto: 10, fechaVencimiento: '2026-01-10' });
      const token = await login(app, 'yo@test.com');

      const r = await get(token, { unidadId: ajena.id }).expect(403);
      expect(r.body.message).toBe('No tienes permiso para esta acción');
      expect(r.body).not.toHaveProperty('datos');
      expect(r.body).not.toHaveProperty('saldoTotal');

      await get(token, { unidadId: '0b9f1c2e-3a4b-4c5d-8e6f-123456789abc' }).expect(403);
    });

    it('ADMINISTRADOR recibe 403 y sin token 401', async () => {
      await crearUsuario(prisma, 'admin@test.com', { rol: Rol.ADMINISTRADOR });
      const token = await login(app, 'admin@test.com');
      await get(token).expect(403);
      await get(null).expect(401);
    });

    it('residente sin unidades recibe 200 vacío con saldo 0', async () => {
      await crearUsuario(prisma, 'sin@test.com');
      const token = await login(app, 'sin@test.com');
      const r = await get(token).expect(200);
      expect(r.body).toEqual({ unidad: null, unidades: [], saldoTotal: 0, datos: [], total: 0, pagina: 1, porPagina: 20 });
    });
  });
});
