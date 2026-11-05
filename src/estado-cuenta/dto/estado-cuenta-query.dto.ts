import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';
import { EstadoCuota } from '@PrismaClient';

const FECHA_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Valida que una fecha con formato correcto exista en el calendario. Sin esto,
 * "2026-02-31" pasa la regex, `new Date()` la vuelve Invalid Date y Prisma
 * lanza (500). Si el formato ni siquiera coincide, lo reporta `@Matches`.
 */
function EsFechaReal(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'esFechaReal',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !FECHA_ISO.test(value)) return true;
          const fecha = new Date(`${value}T00:00:00.000Z`);
          // Date normaliza (31 feb -> 3 mar): si al volver a texto cambia, no existía.
          return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
        },
      },
    });
}

/**
 * Valida que esta fecha no sea posterior a la de otra propiedad del DTO.
 * Las fechas son YYYY-MM-DD, así que la comparación de texto equivale a la
 * cronológica.
 */
function NoPosteriorA(otra: string, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'noPosteriorA',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const otraFecha = (args.object as Record<string, unknown>)[otra];
          if (typeof value !== 'string' || typeof otraFecha !== 'string') return true;
          return value <= otraFecha;
        },
      },
    });
}

export const PAGE_SIZE = 20;

export class EstadoCuentaQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Unidad a consultar. Por defecto, la primera por código.' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ enum: EstadoCuota, enumName: 'EstadoCuota' })
  @IsOptional()
  @IsEnum(EstadoCuota)
  estado?: EstadoCuota;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Vencimiento desde (inclusive).' })
  @IsOptional()
  @Matches(FECHA_ISO, { message: 'desde debe tener formato YYYY-MM-DD' })
  @EsFechaReal('La fecha desde no es una fecha válida')
  @NoPosteriorA('hasta', 'La fecha desde no puede ser mayor que la fecha hasta')
  desde?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Vencimiento hasta (inclusive).' })
  @IsOptional()
  @Matches(FECHA_ISO, { message: 'hasta debe tener formato YYYY-MM-DD' })
  @EsFechaReal('La fecha hasta no es una fecha válida')
  hasta?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (tamaño fijo de 20).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;
}
