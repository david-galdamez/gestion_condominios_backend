import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoCuentaQueryDto } from './estado-cuenta-query.dto.js';

const errores = async (plain: object) =>
  (await validate(plainToInstance(EstadoCuentaQueryDto, plain))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('EstadoCuentaQueryDto', () => {
  it('acepta una query vacía con pagina 1', async () => {
    expect(await errores({})).toEqual([]);
    expect(plainToInstance(EstadoCuentaQueryDto, {}).pagina).toBe(1);
  });

  it('rechaza desde > hasta con el mensaje esperado', async () => {
    expect(await errores({ desde: '2026-12-01', hasta: '2026-01-01' })).toContain(
      'La fecha desde no puede ser mayor que la fecha hasta',
    );
  });

  it('acepta desde == hasta', async () => {
    expect(await errores({ desde: '2026-01-01', hasta: '2026-01-01' })).toEqual([]);
  });

  it('rechaza un estado inválido', async () => {
    expect((await errores({ estado: 'XYZ' })).length).toBeGreaterThan(0);
  });

  it('rechaza fechas mal formadas y páginas < 1', async () => {
    expect((await errores({ desde: '01/01/2026' })).length).toBeGreaterThan(0);
    expect((await errores({ pagina: '0' })).length).toBeGreaterThan(0);
  });

  it('rechaza fechas imposibles con mensaje claro', async () => {
    expect(await errores({ desde: '2026-02-31' })).toContain('La fecha desde no es una fecha válida');
    expect(await errores({ hasta: '2026-04-31' })).toContain('La fecha hasta no es una fecha válida');
  });

  it('respeta los años bisiestos', async () => {
    expect(await errores({ desde: '2028-02-29' })).toEqual([]);
    expect(await errores({ desde: '2026-02-29' })).toContain('La fecha desde no es una fecha válida');
    expect(await errores({ hasta: '2100-02-29' })).toContain('La fecha hasta no es una fecha válida');
  });

  it('rechaza unidadId que no es uuid', async () => {
    expect((await errores({ unidadId: 'abc' })).length).toBeGreaterThan(0);
    expect(await errores({ unidadId: '7d9f2c1e-3b4a-4c5d-8e6f-0a1b2c3d4e5f' })).toEqual([]);
  });

  it('rechaza pagina no entera', async () => {
    expect((await errores({ pagina: '1.5' })).length).toBeGreaterThan(0);
    expect((await errores({ pagina: 'abc' })).length).toBeGreaterThan(0);
    expect((await errores({ pagina: '-2' })).length).toBeGreaterThan(0);
  });

  it('acepta estados válidos', async () => {
    for (const estado of ['PENDIENTE', 'VENCIDA', 'PAGADA']) expect(await errores({ estado })).toEqual([]);
  });
});
