import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, Prisma, type Cuota } from '@PrismaClient';

export interface FiltrosCuota {
  unidadId: string;
  estado?: EstadoCuota;
  /** Fecha (medianoche UTC) inclusive sobre fecha_vencimiento. */
  desde?: Date;
  hasta?: Date;
}

export interface UnidadResumen {
  id: string;
  codigo: string;
}

/**
 * Único punto del módulo que habla con las tablas `cuota` y `usuario_unidad`.
 * No expone borrado: las cuotas son historial contable.
 */
@Injectable()
export class CuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Unidades del usuario, ordenadas por código (alimenta el selector). */
  async findUnidadesDeUsuario(usuarioId: string): Promise<UnidadResumen[]> {
    return this.prisma.unidad.findMany({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true, codigo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  async findPagina(
    filtros: FiltrosCuota,
    skip: number,
    take: number,
  ): Promise<{ cuotas: Cuota[]; total: number }> {
    const where = this.buildWhere(filtros);
    const [cuotas, total] = await Promise.all([
      this.prisma.cuota.findMany({
        where,
        orderBy: { periodo: 'desc' },
        skip,
        take,
      }),
      this.prisma.cuota.count({ where }),
    ]);
    return { cuotas, total };
  }

  /**
   * Suma de cuotas PENDIENTE y VENCIDA de la unidad. Se hace en la base con
   * Decimal para no acumular errores de punto flotante.
   */
  async sumarSaldoPendiente(unidadId: string): Promise<Prisma.Decimal> {
    const { _sum } = await this.prisma.cuota.aggregate({
      where: {
        unidadId,
        estado: { in: [EstadoCuota.PENDIENTE, EstadoCuota.VENCIDA] },
      },
      _sum: { monto: true },
    });
    return _sum.monto ?? new Prisma.Decimal(0);
  }

  /**
   * Pasa a VENCIDA, en una sola sentencia, las PENDIENTE con vencimiento
   * anterior a `hoy`. Devuelve cuántas filas cambió.
   */
  async marcarVencidas(hoy: Date): Promise<number> {
    const { count } = await this.prisma.cuota.updateMany({
      where: { estado: EstadoCuota.PENDIENTE, fechaVencimiento: { lt: hoy } },
      data: { estado: EstadoCuota.VENCIDA },
    });
    return count;
  }

  private buildWhere({ unidadId, estado, desde, hasta }: FiltrosCuota): Prisma.CuotaWhereInput {
    return {
      unidadId,
      ...(estado && { estado }),
      ...((desde || hasta) && {
        fechaVencimiento: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) },
      }),
    };
  }
}
