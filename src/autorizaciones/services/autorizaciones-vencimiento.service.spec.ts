import type { AutorizacionRepository } from '../repositories/autorizacion.repository.js';
import { AutorizacionesVencimientoService } from './autorizaciones-vencimiento.service.js';

describe('AutorizacionesVencimientoService', () => {
  it('usa la fecha de El Salvador (a las 03:00 UTC aún es el día anterior)', async () => {
    const repo = { marcarVencidas: vi.fn().mockResolvedValue(4) };
    const service = new AutorizacionesVencimientoService(repo as unknown as AutorizacionRepository);
    expect(await service.marcarVencidas(new Date('2026-11-05T03:00:00Z'))).toBe(4);
    expect(repo.marcarVencidas).toHaveBeenCalledWith(new Date('2026-11-04T00:00:00.000Z'));
  });

  it('es idempotente: la segunda corrida devuelve 0', async () => {
    const repo = {
      marcarVencidas: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
    };
    const service = new AutorizacionesVencimientoService(repo as unknown as AutorizacionRepository);
    const ahora = new Date('2026-11-04T12:00:00Z');
    expect(await service.marcarVencidas(ahora)).toBe(2);
    expect(await service.marcarVencidas(ahora)).toBe(0);
  });

  it('tareaDiaria delega en marcarVencidas', async () => {
    const repo = { marcarVencidas: vi.fn().mockResolvedValue(0) };
    await new AutorizacionesVencimientoService(repo as unknown as AutorizacionRepository).tareaDiaria();
    expect(repo.marcarVencidas).toHaveBeenCalledTimes(1);
  });
});
