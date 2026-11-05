import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';
import { EnVentanaDesdeHoy, EsFechaReal, FECHA_ISO } from '@Common/fechas';
import { TipoDocumento } from '@PrismaClient';

export const MSG_DOCUMENTO = 'El número de documento no tiene el formato correcto';
export const MSG_FECHA = 'Elige una fecha entre hoy y los próximos 30 días';
/** Días hacia adelante que se permite pre-autorizar (hoy incluido). */
export const MAX_DIAS_ANTICIPACION = 30;

const DUI = /^\d{8}-\d$/;
const PASAPORTE = /^[A-Z0-9]{6,12}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const aTexto = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** El formato válido depende del tipo de documento, por eso mira otra propiedad del DTO. */
function DocumentoSegunTipo(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'documentoSegunTipo',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const { tipoDocumento } = args.object as {
            tipoDocumento?: TipoDocumento;
          };
          if (tipoDocumento === TipoDocumento.DUI) return DUI.test(value);
          if (tipoDocumento === TipoDocumento.PASAPORTE) return PASAPORTE.test(value);
          // Tipo inválido o ausente: ese error ya lo reporta @IsEnum.
          return true;
        },
      },
    });
}

export class CrearAutorizacionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unidad de la visita. Opcional solo si el residente tiene una única unidad.',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiProperty({ minLength: 3, maxLength: 60, example: 'María López' })
  @Transform(({ value }) => aTexto(value))
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre!: string;

  @ApiProperty({ enum: TipoDocumento, enumName: 'TipoDocumento' })
  @IsEnum(TipoDocumento)
  tipoDocumento!: TipoDocumento;

  @ApiProperty({
    example: '01234567-8',
    description: 'DUI ########-# o pasaporte alfanumérico de 6 a 12 (se pasa a mayúsculas).',
  })
  // Se normaliza antes de validar: el pasaporte en minúsculas es válido.
  @Transform(({ value, obj }: { value: unknown; obj: { tipoDocumento?: unknown } }) => {
    const texto = aTexto(value);
    return typeof texto === 'string' && obj.tipoDocumento === TipoDocumento.PASAPORTE ? texto.toUpperCase() : texto;
  })
  @DocumentoSegunTipo(MSG_DOCUMENTO)
  numeroDocumento!: string;

  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    example: 'P123-456',
    description: 'Se guarda en mayúsculas; vacío = sin placa.',
  })
  @Transform(({ value }) => {
    const texto = aTexto(value);
    return typeof texto === 'string' ? texto.toUpperCase() || null : texto;
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string | null;

  @ApiProperty({
    example: '2026-11-10',
    description: 'YYYY-MM-DD, entre hoy y hoy+30 (America/El_Salvador).',
  })
  @Matches(FECHA_ISO, { message: MSG_FECHA })
  @EsFechaReal(MSG_FECHA)
  @EnVentanaDesdeHoy(MAX_DIAS_ANTICIPACION, MSG_FECHA)
  fechaVisita!: string;

  @ApiProperty({
    example: '14:30',
    description: 'HH:mm (00:00 a 23:59). Puede ser una hora ya pasada si la fecha es hoy.',
  })
  @Matches(HORA, { message: 'La hora estimada debe tener formato HH:mm' })
  horaEstimada!: string;
}
