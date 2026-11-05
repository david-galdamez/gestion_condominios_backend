/** Zona horaria del negocio: todo "hoy" del dominio se calcula acá. */
export const ZONA_NEGOCIO = 'America/El_Salvador';

/** Formato YYYY-MM-DD (solo forma; que el día exista lo valida `esFechaReal`). */
export const FECHA_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "Hoy" en la zona del negocio como YYYY-MM-DD (en-CA formatea así). */
export function hoyEnZonaNegocio(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Suma `dias` (puede ser negativo) a una fecha YYYY-MM-DD. Aritmética en UTC: sin husos ni horario de verano. */
export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Indica si una fecha con formato correcto existe en el calendario. Date
 * normaliza (31 feb -> 3 mar): si al volver a texto cambia, no existía.
 */
export function esFechaReal(value: string): boolean {
  if (!FECHA_ISO.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD -> medianoche UTC, que es como Prisma maneja @db.Date. */
export function aFechaUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * ¿La fecha está entre hoy y hoy+`maxDias` (inclusive) en la zona del negocio?
 * Las fechas YYYY-MM-DD comparan igual como texto que cronológicamente.
 */
export function estaEnVentanaDesdeHoy(fecha: string, maxDias: number, ahora: Date = new Date()): boolean {
  if (!esFechaReal(fecha)) return false;
  const hoy = hoyEnZonaNegocio(ahora);
  return fecha >= hoy && fecha <= sumarDias(hoy, maxDias);
}
