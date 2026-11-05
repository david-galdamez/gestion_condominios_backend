import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { aFechaUtc, hoyEnZonaNegocio, ZONA_NEGOCIO } from '@Common/fechas';
import { AutorizacionRepository } from '@Autorizaciones/repositories';

@Injectable()
export class AutorizacionesVencimientoService {
  private readonly logger = new Logger(AutorizacionesVencimientoService.name);

  constructor(private readonly autorizaciones: AutorizacionRepository) {}

  /**
   * Corre a las 23:59 de El Salvador: a esa hora el día de la visita está por
   * terminar y lo no usado ya no sirve. Idempotente: solo toca VIGENTE.
   */
  @Cron('59 23 * * *', { timeZone: ZONA_NEGOCIO })
  async tareaDiaria(): Promise<void> {
    await this.marcarVencidas();
  }

  /** Vence toda VIGENTE cuya fecha de visita es hoy o anterior (hora de El Salvador). */
  async marcarVencidas(ahora: Date = new Date()): Promise<number> {
    const hoy = hoyEnZonaNegocio(ahora);
    const count = await this.autorizaciones.marcarVencidas(aFechaUtc(hoy));
    this.logger.log(`Autorizaciones marcadas como VENCIDA: ${count} (hoy=${hoy})`);
    return count;
  }
}
