import { ForbiddenException } from '@nestjs/common';
import { EstadoCuota, Prisma } from '@PrismaClient';
import { EstadoCuentaService } from './estado-cuenta.service.js';
import type { CuotaRepository } from '../repositories/cuota.repository.js';
import type { EstadoCuentaQueryDto } from '../dto/estado-cuenta-query.dto.js';

describe('EstadoCuentaService', () => {
  const u1 = { id: 'u-1', codigo: 'A-101' };
  const u2 = { id: 'u-2', codigo: 'B-205' };
  const repo = {
    findUnidadesDeUsuario: vi.fn(),
    findPagina: vi.fn(),
    sumarSaldoPendiente: vi.fn(),
  };
  const service = new EstadoCuentaService(repo as unknown as CuotaRepository);
  const query = (q: Partial<EstadoCuentaQueryDto> = {}) => ({ pagina: 1, ...q }) as EstadoCuentaQueryDto;

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findUnidadesDeUsuario.mockResolvedValue([u1, u2]);
    repo.sumarSaldoPendiente.mockResolvedValue(new Prisma.Decimal('90'));
    repo.findPagina.mockResolvedValue({
      total: 1,
      cuotas: [
        {
          id: 'c-1',
          periodo: '2026-10',
          monto: new Prisma.Decimal('45'),
          fechaVencimiento: new Date('2026-10-10T00:00:00.000Z'),
          estado: EstadoCuota.VENCIDA,
        },
      ],
    });
  });

  it('usa la primera unidad por código si no viene unidadId', async () => {
    const r = await service.consultar('user', query());
    expect(r.unidad).toEqual(u1);
    expect(r.unidades).toEqual([u1, u2]);
    expect(repo.findPagina.mock.calls[0][0].unidadId).toBe('u-1');
    expect(r.datos[0]).toEqual({
      id: 'c-1',
      periodo: '2026-10',
      monto: 45,
      fechaVencimiento: '2026-10-10',
      estado: 'VENCIDA',
    });
  });

  it('lanza 403 con una unidad ajena y no consulta datos', async () => {
    await expect(service.consultar('user', query({ unidadId: 'otra' }))).rejects.toThrow(ForbiddenException);
    expect(repo.findPagina).not.toHaveBeenCalled();
    expect(repo.sumarSaldoPendiente).not.toHaveBeenCalled();
  });

  it('responde vacío si el usuario no tiene unidades', async () => {
    repo.findUnidadesDeUsuario.mockResolvedValue([]);
    const r = await service.consultar('user', query());
    expect(r).toEqual({ unidad: null, unidades: [], saldoTotal: 0, datos: [], total: 0, pagina: 1, porPagina: 20 });
  });

  it('el saldo lleva 2 decimales y no recibe los filtros', async () => {
    repo.sumarSaldoPendiente.mockResolvedValue(new Prisma.Decimal('90.1'));
    const r = await service.consultar('user', query({ unidadId: 'u-2', estado: EstadoCuota.PAGADA, desde: '2026-01-01' }));
    expect(r.saldoTotal).toBe(90.1);
    expect(repo.sumarSaldoPendiente).toHaveBeenCalledWith('u-2');
    expect(repo.findPagina.mock.calls[0][0]).toMatchObject({ estado: 'PAGADA', desde: new Date('2026-01-01T00:00:00.000Z') });
  });

  it('pagina con skip 20 en la página 2', async () => {
    const r = await service.consultar('user', query({ pagina: 2 }));
    expect(repo.findPagina).toHaveBeenCalledWith(expect.anything(), 20, 20);
    expect(r.pagina).toBe(2);
    expect(r.porPagina).toBe(20);
  });

  it('usa la unidad indicada si es propia', async () => {
    const r = await service.consultar('user', query({ unidadId: 'u-2' }));
    expect(r.unidad).toEqual(u2);
    expect(repo.findPagina.mock.calls[0][0].unidadId).toBe('u-2');
  });

  it('lanza 403 con el mensaje esperado si la unidad no existe', async () => {
    await expect(service.consultar('user', query({ unidadId: 'inexistente' }))).rejects.toMatchObject({
      message: 'No tienes permiso para esta acción',
    });
  });

  it('redondea el saldo a 2 decimales', async () => {
    repo.sumarSaldoPendiente.mockResolvedValue(new Prisma.Decimal('75.349'));
    expect((await service.consultar('user', query())).saldoTotal).toBe(75.35);
  });

  it('serializa fechaVencimiento en UTC aunque el proceso esté en otra zona', async () => {
    repo.findPagina.mockResolvedValue({
      total: 1,
      cuotas: [
        {
          id: 'c-2',
          periodo: '2026-01',
          monto: new Prisma.Decimal('10.5'),
          fechaVencimiento: new Date('2026-01-01T00:00:00.000Z'),
          estado: EstadoCuota.PENDIENTE,
        },
      ],
    });
    const r = await service.consultar('user', query());
    expect(r.datos[0].fechaVencimiento).toBe('2026-01-01');
    expect(r.datos[0].monto).toBe(10.5);
  });

  it('pasa el rango hasta como medianoche UTC', async () => {
    await service.consultar('user', query({ hasta: '2026-12-31' }));
    expect(repo.findPagina.mock.calls[0][0].hasta).toEqual(new Date('2026-12-31T00:00:00.000Z'));
  });
});
