import { ApiProperty } from '@nestjs/swagger';
import { UnidadResumenDto } from '@Unidades/dto';
import { EstadoAutorizacion, TipoDocumento } from '@PrismaClient';

export class AutorizacionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: '048213',
    description: '6 dígitos; único por fecha de visita.',
  })
  codigo!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ enum: TipoDocumento, enumName: 'TipoDocumento' })
  tipoDocumento!: TipoDocumento;

  @ApiProperty()
  numeroDocumento!: string;

  @ApiProperty({ nullable: true, type: String })
  placa!: string | null;

  @ApiProperty({ example: '2026-11-10', description: 'YYYY-MM-DD' })
  fechaVisita!: string;

  @ApiProperty({ example: '14:30', description: 'HH:mm' })
  horaEstimada!: string;

  @ApiProperty({ enum: EstadoAutorizacion, enumName: 'EstadoAutorizacion' })
  estado!: EstadoAutorizacion;

  @ApiProperty({ type: UnidadResumenDto })
  unidad!: UnidadResumenDto;
}

export class MisAutorizacionesResponseDto {
  @ApiProperty({ type: AutorizacionDto, isArray: true })
  datos!: AutorizacionDto[];
}
