import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { hoyEnZonaNegocio, sumarDias } from '@Common/fechas';
import { CrearAutorizacionDto, MSG_DOCUMENTO, MSG_FECHA } from './crear-autorizacion.dto.js';

const manana = () => sumarDias(hoyEnZonaNegocio(), 1);

const base = () => ({
  nombre: 'María López',
  tipoDocumento: 'DUI',
  numeroDocumento: '01234567-8',
  fechaVisita: manana(),
  horaEstimada: '14:30',
});

const instancia = (extra: object = {}) => plainToInstance(CrearAutorizacionDto, { ...base(), ...extra });
const errores = async (extra: object = {}) =>
  (await validate(instancia(extra))).flatMap((e) => Object.values(e.constraints ?? {}));

describe('CrearAutorizacionDto', () => {
  it('acepta un payload válido (sin placa ni unidadId)', async () => {
    expect(await errores()).toEqual([]);
  });

  it.each([
    ['2 caracteres', 'Ab', false],
    ['3 caracteres', 'Abc', true],
    ['60 caracteres', 'a'.repeat(60), true],
    ['61 caracteres', 'a'.repeat(61), false],
    ['solo espacios', '   ', false],
  ])('nombre: %s', async (_t, nombre, valido) => {
    expect((await errores({ nombre })).length === 0).toBe(valido);
  });

  it('recorta espacios del nombre', () => {
    expect(instancia({ nombre: '  Ana  ' }).nombre).toBe('Ana');
  });

  it('DUI válido pasa, mal formado falla con el mensaje exacto', async () => {
    expect(await errores({ numeroDocumento: '01234567-8' })).toEqual([]);
    expect(await errores({ numeroDocumento: '012345678' })).toContain(MSG_DOCUMENTO);
    expect(await errores({ numeroDocumento: '1234567-8' })).toContain(MSG_DOCUMENTO);
  });

  it('pasaporte en minúsculas se normaliza a mayúsculas', async () => {
    const dto = instancia({
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: 'ab123456',
    });
    expect(dto.numeroDocumento).toBe('AB123456');
    expect((await validate(dto)).length).toBe(0);
  });

  it('pasaporte de 5 y 13 caracteres falla, 6 y 12 pasan', async () => {
    const p = (n: number) => ({
      tipoDocumento: 'PASAPORTE',
      numeroDocumento: 'A'.repeat(n),
    });
    expect(await errores(p(5))).toContain(MSG_DOCUMENTO);
    expect(await errores(p(13))).toContain(MSG_DOCUMENTO);
    expect(await errores(p(6))).toEqual([]);
    expect(await errores(p(12))).toEqual([]);
  });

  it('un DUI no vale como pasaporte con guion', async () => {
    expect(
      await errores({
        tipoDocumento: 'PASAPORTE',
        numeroDocumento: '01234567-8',
      }),
    ).toContain(MSG_DOCUMENTO);
  });

  it('tipoDocumento inválido falla', async () => {
    expect((await errores({ tipoDocumento: 'CARNET' })).length).toBeGreaterThan(0);
  });

  it('placa: 10 pasa, 11 falla, se pasa a mayúsculas y vacío -> null', async () => {
    expect(await errores({ placa: 'a'.repeat(10) })).toEqual([]);
    expect((await errores({ placa: 'a'.repeat(11) })).length).toBeGreaterThan(0);
    expect(instancia({ placa: ' p123-456 ' }).placa).toBe('P123-456');
    expect(instancia({ placa: '   ' }).placa).toBeNull();
    expect(await errores({ placa: '   ' })).toEqual([]);
  });

  it('hora: 00:00 y 23:59 pasan; 24:00, 7:30 y 12:60 fallan', async () => {
    expect(await errores({ horaEstimada: '00:00' })).toEqual([]);
    expect(await errores({ horaEstimada: '23:59' })).toEqual([]);
    for (const h of ['24:00', '7:30', '12:60', '1430']) {
      expect((await errores({ horaEstimada: h })).length).toBeGreaterThan(0);
    }
  });

  it('fecha: hoy y hoy+30 pasan; ayer, hoy+31, imposible y mal formada fallan con el mensaje exacto', async () => {
    const hoy = hoyEnZonaNegocio();
    expect(await errores({ fechaVisita: hoy })).toEqual([]);
    expect(await errores({ fechaVisita: sumarDias(hoy, 30) })).toEqual([]);
    for (const f of [sumarDias(hoy, -1), sumarDias(hoy, 31), '2026-02-31', '04/11/2026']) {
      expect(await errores({ fechaVisita: f })).toContain(MSG_FECHA);
    }
  });

  it('unidadId debe ser uuid', async () => {
    expect((await errores({ unidadId: 'abc' })).length).toBeGreaterThan(0);
    expect(await errores({ unidadId: '3f0f6b2e-5c1d-4b8e-9a37-0d2f6a1c4e55' })).toEqual([]);
  });
});
