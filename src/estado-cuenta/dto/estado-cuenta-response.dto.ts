import { ApiProperty } from '@nestjs/swagger';
import { UnidadResumenDto } from '@Unidades/dto';
import { EstadoCuota } from '@PrismaClient';

export class CuotaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-10' })
  periodo!: string;

  @ApiProperty({ example: 45.0 })
  monto!: number;

  @ApiProperty({ example: '2026-10-10', description: 'YYYY-MM-DD' })
  fechaVencimiento!: string;

  @ApiProperty({ enum: EstadoCuota, enumName: 'EstadoCuota' })
  estado!: EstadoCuota;
}

export class EstadoCuentaResponseDto {
  @ApiProperty({ type: UnidadResumenDto, nullable: true })
  unidad!: UnidadResumenDto | null;

  @ApiProperty({
    type: [UnidadResumenDto],
    description: 'Todas las unidades del usuario (selector).',
  })
  unidades!: UnidadResumenDto[];

  @ApiProperty({
    example: 90.0,
    description: 'Pendiente + vencida, sin recargo; ignora los filtros.',
  })
  saldoTotal!: number;

  @ApiProperty({ type: [CuotaDto] })
  datos!: CuotaDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  porPagina!: number;
}
