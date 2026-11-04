import { ForbiddenException, Injectable } from '@nestjs/common';
import { CuotaRepository, type UnidadResumen } from '@EstadoCuenta/repositories';
import { PAGE_SIZE, type EstadoCuentaQueryDto, type EstadoCuentaResponseDto } from '@EstadoCuenta/dto';

/** Fecha YYYY-MM-DD -> medianoche UTC, que es como Prisma maneja @db.Date. */
const aFechaUtc = (iso?: string) => (iso ? new Date(`${iso}T00:00:00.000Z`) : undefined);

@Injectable()
export class EstadoCuentaService {
  constructor(private readonly cuotas: CuotaRepository) {}

  async consultar(usuarioId: string, query: EstadoCuentaQueryDto): Promise<EstadoCuentaResponseDto> {
    const pagina = query.pagina ?? 1;
    const unidades = await this.cuotas.findUnidadesDeUsuario(usuarioId);

    // Se valida contra las unidades de la sesión: una unidad ajena o
    // inexistente responde igual (403) para no revelar qué ids existen.
    let unidad: UnidadResumen | null = unidades[0] ?? null;
    if (query.unidadId) {
      unidad = unidades.find((u) => u.id === query.unidadId) ?? null;
      if (!unidad) throw new ForbiddenException('No tienes permiso para esta acción');
    }

    if (!unidad) {
      return { unidad: null, unidades, saldoTotal: 0, datos: [], total: 0, pagina, porPagina: PAGE_SIZE };
    }

    const [saldo, { cuotas, total }] = await Promise.all([
      // El saldo no recibe los filtros a propósito.
      this.cuotas.sumarSaldoPendiente(unidad.id),
      this.cuotas.findPagina(
        {
          unidadId: unidad.id,
          estado: query.estado,
          desde: aFechaUtc(query.desde),
          hasta: aFechaUtc(query.hasta),
        },
        (pagina - 1) * PAGE_SIZE,
        PAGE_SIZE,
      ),
    ]);

    return {
      unidad,
      unidades,
      saldoTotal: Number(saldo.toFixed(2)),
      datos: cuotas.map((c) => ({
        id: c.id,
        periodo: c.periodo,
        monto: Number(c.monto.toFixed(2)),
        // @db.Date llega como medianoche UTC: se serializa en UTC.
        fechaVencimiento: c.fechaVencimiento.toISOString().slice(0, 10),
        estado: c.estado,
      })),
      total,
      pagina,
      porPagina: PAGE_SIZE,
    };
  }
}
