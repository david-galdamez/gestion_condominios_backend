import { ApiProperty } from '@nestjs/swagger';

export class UnidadResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'A-101' })
  codigo!: string;
}
