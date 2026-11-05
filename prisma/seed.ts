import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { EstadoAutorizacion, EstadoCuota, PrismaClient, Rol, TipoDocumento } from '../src/generated/prisma/client.js';

/** Mismo cálculo que src/common/fechas (el seed corre fuera de Nest y no usa los alias). */
const ZONA_NEGOCIO = 'America/El_Salvador';
const hoyEnZonaNegocio = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const sumarDias = (iso: string, dias: number) =>
  new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * 86_400_000).toISOString().slice(0, 10);

const PASSWORD = 'Demo1234!';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TORRES = ['Torre A', 'Torre B'];

const UNIDADES = [
  { codigo: 'A-101', torre: 'Torre A' },
  { codigo: 'A-102', torre: 'Torre A' },
  { codigo: 'B-205', torre: 'Torre B' },
];

const USUARIOS = [
  {
    email: 'demo@example.com',
    nombre: 'Usuario Demo',
    rol: Rol.RESIDENTE,
    unidades: [] as string[],
  },
  {
    email: 'residente1@example.com',
    nombre: 'Residente Uno',
    rol: Rol.RESIDENTE,
    unidades: ['A-101', 'B-205'],
  },
  {
    email: 'residente2@example.com',
    nombre: 'Residente Dos',
    rol: Rol.RESIDENTE,
    unidades: ['A-102'],
  },
  {
    email: 'admin@example.com',
    nombre: 'Administrador',
    rol: Rol.ADMINISTRADOR,
    unidades: [] as string[],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Todo con `upsert` para que el seed sea idempotente: se puede correr las
  // veces que haga falta sin duplicar ni fallar.
  const torreIds = new Map<string, string>();
  for (const nombre of TORRES) {
    const torre = await prisma.torre.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    torreIds.set(nombre, torre.id);
  }

  const unidadIds = new Map<string, string>();
  for (const { codigo, torre } of UNIDADES) {
    const unidad = await prisma.unidad.upsert({
      where: { codigo },
      update: {},
      create: { codigo, torreId: torreIds.get(torre)! },
    });
    unidadIds.set(codigo, unidad.id);
  }

  for (const { email, nombre, rol, unidades } of USUARIOS) {
    // `update` re-aplica nombre y rol para que corregir el seed y volver a
    // correrlo repare usuarios creados antes de existir estos campos.
    const user = await prisma.user.upsert({
      where: { email },
      update: { nombre, rol },
      create: { email, nombre, rol, passwordHash },
    });

    for (const codigo of unidades) {
      const unidadId = unidadIds.get(codigo)!;
      await prisma.usuarioUnidad.upsert({
        where: { usuarioId_unidadId: { usuarioId: user.id, unidadId } },
        update: {},
        create: { usuarioId: user.id, unidadId },
      });
    }
  }

  // Cuotas: upsert por (unidadId, periodo) para que sea idempotente.
  type CuotaSeed = { periodo: string; monto: number; estado: EstadoCuota };
  const periodos = (desde: [number, number], n: number) =>
    Array.from({ length: n }, (_, i) => {
      const m = desde[1] - 1 + i;
      return `${desde[0] + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
    });
  const estadoDe = (p: string): EstadoCuota =>
    p >= '2026-11' ? EstadoCuota.PENDIENTE : p >= '2026-09' ? EstadoCuota.VENCIDA : EstadoCuota.PAGADA;

  const cuotasPorUnidad: Record<string, CuotaSeed[]> = {
    // 24 meses 2024-11..2026-10 + 2026-11 (25 filas) para probar paginación.
    'A-101': periodos([2024, 11], 25).map((periodo) => ({
      periodo,
      monto: 45,
      estado: estadoDe(periodo),
    })),
    'B-205': [
      { periodo: '2026-09', monto: 60, estado: EstadoCuota.PAGADA },
      { periodo: '2026-10', monto: 60, estado: EstadoCuota.VENCIDA },
      { periodo: '2026-11', monto: 60, estado: EstadoCuota.PENDIENTE },
    ],
    'A-102': [
      { periodo: '2026-10', monto: 45, estado: EstadoCuota.VENCIDA },
      { periodo: '2026-11', monto: 45, estado: EstadoCuota.PENDIENTE },
    ],
  };
  for (const [codigo, cuotas] of Object.entries(cuotasPorUnidad)) {
    const unidadId = unidadIds.get(codigo)!;
    for (const { periodo, monto, estado } of cuotas) {
      const fechaVencimiento = new Date(`${periodo}-10T00:00:00.000Z`);
      const pagadaEn = estado === EstadoCuota.PAGADA ? new Date(`${periodo}-05T12:00:00.000Z`) : null;
      await prisma.cuota.upsert({
        where: { unidadId_periodo: { unidadId, periodo } },
        update: { monto, fechaVencimiento, estado, pagadaEn },
        create: {
          unidadId,
          periodo,
          monto,
          fechaVencimiento,
          estado,
          pagadaEn,
        },
      });
    }
  }

  // Autorizaciones de visita: fechas relativas a hoy (El Salvador) y códigos
  // fijos, así el upsert por (codigo, fechaVisita) es idempotente el mismo día.
  // Al correrlo otro día las fechas se desplazan y se crean filas nuevas.
  const hoy = hoyEnZonaNegocio();
  const residente = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  const autorizacionesSeed = [
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100001',
      dias: 1,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'María López',
      tipo: TipoDocumento.DUI,
      doc: '01234567-8',
      placa: 'P123-456',
      hora: '10:00',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100002',
      dias: 5,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'Carlos Pérez',
      tipo: TipoDocumento.PASAPORTE,
      doc: 'AB1234567',
      placa: null,
      hora: '15:30',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100003',
      dias: 2,
      estado: EstadoAutorizacion.CANCELADA,
      nombre: 'Ana Gómez',
      tipo: TipoDocumento.DUI,
      doc: '07654321-0',
      placa: null,
      hora: '09:15',
    },
    {
      email: 'residente1@example.com',
      unidad: 'A-101',
      codigo: '100004',
      dias: -1,
      estado: EstadoAutorizacion.VENCIDA,
      nombre: 'Luis Martínez',
      tipo: TipoDocumento.DUI,
      doc: '03333333-3',
      placa: 'P987-654',
      hora: '18:00',
    },
    {
      email: 'residente2@example.com',
      unidad: 'A-102',
      codigo: '200001',
      dias: 1,
      estado: EstadoAutorizacion.VIGENTE,
      nombre: 'Rosa Hernández',
      tipo: TipoDocumento.DUI,
      doc: '04444444-4',
      placa: null,
      hora: '11:45',
    },
  ];
  for (const a of autorizacionesSeed) {
    const fechaVisita = new Date(`${sumarDias(hoy, a.dias)}T00:00:00.000Z`);
    const datos = {
      unidadId: unidadIds.get(a.unidad)!,
      residenteId: await residente(a.email),
      nombre: a.nombre,
      tipoDocumento: a.tipo,
      numeroDocumento: a.doc,
      placa: a.placa,
      horaEstimada: new Date(`1970-01-01T${a.hora}:00.000Z`),
      estado: a.estado,
    };
    await prisma.autorizacionVisita.upsert({
      where: { codigo_fechaVisita: { codigo: a.codigo, fechaVisita } },
      update: datos,
      create: { ...datos, codigo: a.codigo, fechaVisita },
    });
  }

  console.log('Seed listo. Credenciales (contraseña común: ' + PASSWORD + '):');
  for (const { email, rol, unidades } of USUARIOS) {
    console.log(`  ${email}  [${rol}]  unidades: ${unidades.join(', ') || '-'}`);
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
