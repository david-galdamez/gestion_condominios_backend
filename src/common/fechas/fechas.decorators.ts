import { registerDecorator } from 'class-validator';
import { esFechaReal, estaEnVentanaDesdeHoy, FECHA_ISO } from './fechas.js';

/**
 * Valida que una fecha con formato correcto exista en el calendario. Sin esto,
 * "2026-02-31" pasa la regex, `new Date()` la vuelve Invalid Date y Prisma
 * lanza (500). Si el formato ni siquiera coincide, lo reporta `@Matches`.
 */
export function EsFechaReal(message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'esFechaReal',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !FECHA_ISO.test(value) || esFechaReal(value),
      },
    });
}

/**
 * Valida que la fecha caiga entre hoy y hoy+`maxDias` (inclusive) en la zona
 * del negocio. "Hoy" se calcula al validar, no al arrancar el proceso.
 */
export function EnVentanaDesdeHoy(maxDias: number, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'enVentanaDesdeHoy',
      target: target.constructor,
      propertyName,
      options: { message },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && estaEnVentanaDesdeHoy(value, maxDias),
      },
    });
}
