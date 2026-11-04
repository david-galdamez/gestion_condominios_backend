import { CuotasVencimientoService, hoyEnZonaNegocio } from './cuotas-vencimiento.service.js';
import type { CuotaRepository } from '../repositories/cuota.repository.js';

describe('CuotasVencimientoService', () => {
  it('calcula hoy en America/El_Salvador cerca de medianoche UTC', () => {
    expect(hoyEnZonaNegocio(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-03');
    expect(hoyEnZonaNegocio(new Date('2026-11-04T06:00:00Z'))).toBe('2026-11-04');
  });

  it('llama al update con la fecha local correcta y devuelve el conteo', async () => {
    const repo = { marcarVencidas: vi.fn().mockResolvedValue(3) };
    const service = new CuotasVencimientoService(repo as unknown as CuotaRepository);
    const n = await service.marcarVencidas(new Date('2026-11-04T03:00:00Z'));
    expect(n).toBe(3);
    expect(repo.marcarVencidas).toHaveBeenCalledWith(new Date('2026-11-03T00:00:00.000Z'));
  });

  it('a las 05:59 UTC todavía es el día anterior en El Salvador (UTC-6)', () => {
    expect(hoyEnZonaNegocio(new Date('2026-11-04T05:59:59Z'))).toBe('2026-11-03');
    expect(hoyEnZonaNegocio(new Date('2026-11-04T23:59:59Z'))).toBe('2026-11-04');
  });

  it('delega la idempotencia al repositorio: dos llamadas, dos delegaciones', async () => {
    const repo = { marcarVencidas: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0) };
    const service = new CuotasVencimientoService(repo as unknown as CuotaRepository);
    const ahora = new Date('2026-11-04T12:00:00Z');
    expect(await service.marcarVencidas(ahora)).toBe(2);
    expect(await service.marcarVencidas(ahora)).toBe(0);
    expect(repo.marcarVencidas).toHaveBeenCalledTimes(2);
  });

  it('tareaDiaria invoca marcarVencidas', async () => {
    const repo = { marcarVencidas: vi.fn().mockResolvedValue(0) };
    const service = new CuotasVencimientoService(repo as unknown as CuotaRepository);
    await service.tareaDiaria();
    expect(repo.marcarVencidas).toHaveBeenCalledTimes(1);
  });
});
