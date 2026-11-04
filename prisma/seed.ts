import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Rol } from '../src/generated/prisma/client.js';

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
  { email: 'demo@example.com', nombre: 'Usuario Demo', rol: Rol.RESIDENTE, unidades: [] as string[] },
  { email: 'residente1@example.com', nombre: 'Residente Uno', rol: Rol.RESIDENTE, unidades: ['A-101', 'B-205'] },
  { email: 'residente2@example.com', nombre: 'Residente Dos', rol: Rol.RESIDENTE, unidades: ['A-102'] },
  { email: 'admin@example.com', nombre: 'Administrador', rol: Rol.ADMINISTRADOR, unidades: [] as string[] },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Todo con `upsert` para que el seed sea idempotente: se puede correr las
  // veces que haga falta sin duplicar ni fallar.
  const torreIds = new Map<string, string>();
  for (const nombre of TORRES) {
    const torre = await prisma.torre.upsert({ where: { nombre }, update: {}, create: { nombre } });
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
