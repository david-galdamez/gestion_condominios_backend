import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

export interface UnidadResumen {
  id: string;
  codigo: string;
}

/** Consultas compartidas sobre `unidad` / `usuario_unidad` (estado de cuenta, autorizaciones, selector). */
@Injectable()
export class UnidadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Unidades del usuario, ordenadas por código (alimenta los selectores). */
  findDeUsuario(usuarioId: string): Promise<UnidadResumen[]> {
    return this.prisma.unidad.findMany({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true, codigo: true },
      orderBy: { codigo: 'asc' },
    });
  }
}
