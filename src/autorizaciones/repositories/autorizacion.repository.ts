import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoAutorizacion, type Prisma } from '@PrismaClient';

const INCLUIR_UNIDAD = {
  unidad: { select: { id: true, codigo: true } },
} satisfies Prisma.AutorizacionVisitaInclude;

export type AutorizacionConUnidad = Prisma.AutorizacionVisitaGetPayload<{
  include: typeof INCLUIR_UNIDAD;
}>;

export type NuevaAutorizacion = Pick<
  Prisma.AutorizacionVisitaUncheckedCreateInput,
  | 'unidadId'
  | 'residenteId'
  | 'nombre'
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'placa'
  | 'fechaVisita'
  | 'horaEstimada'
  | 'codigo'
>;

/** Único punto que habla con `autorizacion_visita`. Sin borrado físico. */
@Injectable()
export class AutorizacionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NuevaAutorizacion): Promise<AutorizacionConUnidad> {
    return this.prisma.autorizacionVisita.create({
      data,
      include: INCLUIR_UNIDAD,
    });
  }

  findByResidente(residenteId: string): Promise<AutorizacionConUnidad[]> {
    return this.prisma.autorizacionVisita.findMany({
      where: { residenteId },
      include: INCLUIR_UNIDAD,
      orderBy: [{ fechaVisita: 'asc' }, { horaEstimada: 'asc' }],
    });
  }

  /** Filtra por residente: una autorización ajena es indistinguible de una inexistente. */
  findOneDeResidente(id: string, residenteId: string): Promise<AutorizacionConUnidad | null> {
    return this.prisma.autorizacionVisita.findFirst({
      where: { id, residenteId },
      include: INCLUIR_UNIDAD,
    });
  }

  /**
   * Cancela solo si sigue VIGENTE, en una sentencia: evita la carrera entre
   * dos cancelaciones (o con el vencimiento). Devuelve filas cambiadas.
   */
  async cancelarSiVigente(id: string, residenteId: string): Promise<number> {
    const { count } = await this.prisma.autorizacionVisita.updateMany({
      where: { id, residenteId, estado: EstadoAutorizacion.VIGENTE },
      data: { estado: EstadoAutorizacion.CANCELADA },
    });
    return count;
  }

  /** Pasa a VENCIDA, en una sola sentencia, las VIGENTE con fecha_visita <= hoy. */
  async marcarVencidas(hoy: Date): Promise<number> {
    const { count } = await this.prisma.autorizacionVisita.updateMany({
      where: { estado: EstadoAutorizacion.VIGENTE, fechaVisita: { lte: hoy } },
      data: { estado: EstadoAutorizacion.VENCIDA },
    });
    return count;
  }
}
