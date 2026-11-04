import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '@Prisma/services';
import { EstadoCuota, Rol } from '@PrismaClient';

export const PASSWORD = 'Demo1234!';

/** Vacía todas las tablas de negocio; CASCADE resuelve el orden de las FK. */
export async function limpiarTablas(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE cuota, usuario_unidad, unidad, torre, refresh_tokens, users CASCADE',
  );
}

export function crearTorre(prisma: PrismaService, nombre = 'Torre A') {
  return prisma.torre.create({ data: { nombre } });
}

export function crearUnidad(prisma: PrismaService, torreId: string, codigo: string) {
  return prisma.unidad.create({ data: { torreId, codigo } });
}

export async function crearUsuario(
  prisma: PrismaService,
  email: string,
  opts: { rol?: Rol; unidadIds?: string[] } = {},
) {
  // Costo 4: suficiente para el login real y rápido en pruebas.
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  return prisma.user.create({
    data: {
      email,
      nombre: email.split('@')[0],
      rol: opts.rol ?? Rol.RESIDENTE,
      passwordHash,
      unidades: { create: (opts.unidadIds ?? []).map((unidadId) => ({ unidadId })) },
    },
  });
}

export function crearCuota(
  prisma: PrismaService,
  data: { unidadId: string; periodo: string; monto: number | string; fechaVencimiento: string; estado?: EstadoCuota },
) {
  return prisma.cuota.create({
    data: {
      unidadId: data.unidadId,
      periodo: data.periodo,
      monto: data.monto,
      fechaVencimiento: new Date(`${data.fechaVencimiento}T00:00:00.000Z`),
      estado: data.estado ?? EstadoCuota.PENDIENTE,
    },
  });
}

/** Login real por HTTP; devuelve el access token. */
export async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}
