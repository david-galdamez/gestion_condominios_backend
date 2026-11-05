import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { aFechaUtc } from '@Common/fechas';
import { AutorizacionRepository, type AutorizacionConUnidad } from '@Autorizaciones/repositories';
import type { AutorizacionDto, CrearAutorizacionDto } from '@Autorizaciones/dto';
import { UnidadRepository } from '@Unidades/repositories';
import { Prisma } from '@PrismaClient';

/** Intentos de generar un código antes de rendirse (colisión en UNIQUE codigo+fecha). */
export const MAX_INTENTOS_CODIGO = 5;

const esColisionUnica = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** "HH:mm" -> Date en 1970-01-01 UTC, que es como Prisma maneja @db.Time. */
const aHoraUtc = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

/** Serializa en UTC: @db.Date y @db.Time llegan como instantes UTC y cualquier otra zona los correría. */
export function aDto(a: AutorizacionConUnidad): AutorizacionDto {
  return {
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    tipoDocumento: a.tipoDocumento,
    numeroDocumento: a.numeroDocumento,
    placa: a.placa,
    fechaVisita: a.fechaVisita.toISOString().slice(0, 10),
    horaEstimada: a.horaEstimada.toISOString().slice(11, 16),
    estado: a.estado,
    unidad: { id: a.unidad.id, codigo: a.unidad.codigo },
  };
}

@Injectable()
export class AutorizacionesService {
  constructor(
    private readonly autorizaciones: AutorizacionRepository,
    private readonly unidades: UnidadRepository,
  ) {}

  async crear(residenteId: string, dto: CrearAutorizacionDto): Promise<AutorizacionDto> {
    const unidadId = await this.resolverUnidad(residenteId, dto.unidadId);
    const datos = {
      unidadId,
      residenteId, // de la sesión, nunca del body
      nombre: dto.nombre,
      tipoDocumento: dto.tipoDocumento,
      numeroDocumento: dto.numeroDocumento,
      placa: dto.placa ?? null,
      fechaVisita: aFechaUtc(dto.fechaVisita),
      horaEstimada: aHoraUtc(dto.horaEstimada),
    };

    // El código es aleatorio y solo es único por día: si choca se prueba otro
    // en vez de consultar antes (consultar primero tendría carrera igual).
    for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        return aDto(await this.autorizaciones.create({ ...datos, codigo }));
      } catch (e) {
        if (!esColisionUnica(e)) throw e;
      }
    }
    throw new ServiceUnavailableException('No se pudo generar un código de acceso único, intenta de nuevo');
  }

  async listarMias(residenteId: string): Promise<{ datos: AutorizacionDto[] }> {
    const filas = await this.autorizaciones.findByResidente(residenteId);
    return { datos: filas.map(aDto) };
  }

  async cancelar(id: string, residenteId: string): Promise<AutorizacionDto> {
    const actual = await this.autorizaciones.findOneDeResidente(id, residenteId);
    if (!actual) throw new NotFoundException('La autorización no existe');
    if (actual.estado !== 'VIGENTE') throw new ConflictException('Esta autorización ya no se puede cancelar');

    // Si otra petición ganó la carrera entre el find y el update, count es 0.
    const count = await this.autorizaciones.cancelarSiVigente(id, residenteId);
    if (count === 0) throw new ConflictException('Esta autorización ya no se puede cancelar');

    return aDto({ ...actual, estado: 'CANCELADA' });
  }

  /** Unidad ajena/inexistente -> 403 (no revela qué ids existen). Sin unidadId: solo se infiere si hay una. */
  private async resolverUnidad(residenteId: string, unidadId?: string): Promise<string> {
    const mias = await this.unidades.findDeUsuario(residenteId);
    if (unidadId) {
      if (!mias.some((u) => u.id === unidadId)) throw new ForbiddenException('No tienes permiso para esta acción');
      return unidadId;
    }
    if (mias.length === 0) throw new BadRequestException('No tienes unidades asignadas');
    if (mias.length > 1) throw new BadRequestException('Selecciona una unidad');
    return mias[0].id;
  }
}
