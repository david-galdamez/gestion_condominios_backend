import { aFechaUtc, esFechaReal, estaEnVentanaDesdeHoy, hoyEnZonaNegocio, sumarDias } from './fechas.js';

describe('fechas', () => {
  // 2026-11-04 12:00 UTC = 06:00 en El Salvador -> hoy es 2026-11-04.
  const ahora = new Date('2026-11-04T12:00:00Z');

  it('hoyEnZonaNegocio respeta UTC-6', () => {
    expect(hoyEnZonaNegocio(new Date('2026-11-04T05:59:59Z'))).toBe('2026-11-03');
    expect(hoyEnZonaNegocio(new Date('2026-11-04T06:00:00Z'))).toBe('2026-11-04');
  });

  it('sumarDias cruza mes, año y bisiesto', () => {
    expect(sumarDias('2026-11-04', 30)).toBe('2026-12-04');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-11-04', -4)).toBe('2026-10-31');
  });

  it('esFechaReal detecta días imposibles y formatos malos', () => {
    expect(esFechaReal('2026-02-31')).toBe(false);
    expect(esFechaReal('2026-02-29')).toBe(false);
    expect(esFechaReal('2028-02-29')).toBe(true);
    expect(esFechaReal('04/11/2026')).toBe(false);
  });

  it('aFechaUtc devuelve medianoche UTC', () => {
    expect(aFechaUtc('2026-11-04').toISOString()).toBe('2026-11-04T00:00:00.000Z');
  });

  describe('estaEnVentanaDesdeHoy(30)', () => {
    it('acepta hoy y hoy+30, rechaza ayer y hoy+31', () => {
      expect(estaEnVentanaDesdeHoy('2026-11-04', 30, ahora)).toBe(true);
      expect(estaEnVentanaDesdeHoy('2026-12-04', 30, ahora)).toBe(true);
      expect(estaEnVentanaDesdeHoy('2026-12-05', 30, ahora)).toBe(false);
      expect(estaEnVentanaDesdeHoy('2026-11-03', 30, ahora)).toBe(false);
    });

    it('usa el día de El Salvador cerca de medianoche UTC', () => {
      // 03:00 UTC del 5 = 21:00 del 4 en El Salvador: hoy sigue siendo el 4.
      const tarde = new Date('2026-11-05T03:00:00Z');
      expect(estaEnVentanaDesdeHoy('2026-11-04', 30, tarde)).toBe(true);
      expect(estaEnVentanaDesdeHoy('2026-12-04', 30, tarde)).toBe(true);
      expect(estaEnVentanaDesdeHoy('2026-12-05', 30, tarde)).toBe(false);
      // 06:00 UTC del 5 = 00:00 del 5 local: ya el 4 es ayer.
      expect(estaEnVentanaDesdeHoy('2026-11-04', 30, new Date('2026-11-05T06:00:00Z'))).toBe(false);
    });

    it('rechaza fechas imposibles', () => {
      expect(estaEnVentanaDesdeHoy('2026-11-31', 30, ahora)).toBe(false);
    });
  });
});
