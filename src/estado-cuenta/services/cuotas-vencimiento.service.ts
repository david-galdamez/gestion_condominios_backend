import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { aFechaUtc, hoyEnZonaNegocio, ZONA_NEGOCIO } from '@Common/fechas';
import { CuotaRepository } from '@EstadoCuenta/repositories';

@Injectable()
export class CuotasVencimientoService {
  private readonly logger = new Logger(CuotasVencimientoService.name);

  constructor(private readonly cuotas: CuotaRepository) {}

  /**
   * Corre a las 00:05 hora de El Salvador (después de medianoche, para que
   * "hoy" ya sea el día nuevo). Idempotente: solo toca cuotas PENDIENTE.
   */
  @Cron('5 0 * * *', { timeZone: ZONA_NEGOCIO })
  async tareaDiaria(): Promise<void> {
    await this.marcarVencidas();
  }

  /** Una cuota vence cuando su fecha es anterior al día actual del negocio. */
  async marcarVencidas(hoy: Date = new Date()): Promise<number> {
    // Fecha local de El Salvador, llevada a medianoche UTC para comparar con
    // la columna DATE (que Prisma entrega/recibe en UTC).
    const fechaHoy = aFechaUtc(hoyEnZonaNegocio(hoy));
    const count = await this.cuotas.marcarVencidas(fechaHoy);
    this.logger.log(`Cuotas marcadas como VENCIDA: ${count} (hoy=${fechaHoy.toISOString().slice(0, 10)})`);
    return count;
  }
}
