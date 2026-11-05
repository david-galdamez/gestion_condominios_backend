/*
  Warnings:

  - Added the required column `nombre` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "rol" AS ENUM ('RESIDENTE', 'ADMINISTRADOR', 'SEGURIDAD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nombre" TEXT NOT NULL DEFAULT 'Usuario',
ADD COLUMN     "rol" "rol" NOT NULL DEFAULT 'RESIDENTE';

-- El DEFAULT temporal permite agregar la columna NOT NULL con filas existentes
-- (p. ej. el usuario demo); se retira enseguida para que el esquema final
-- coincida con schema.prisma (nombre requerido, sin default).
ALTER TABLE "users" ALTER COLUMN "nombre" DROP DEFAULT;

-- CreateTable
CREATE TABLE "torre" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad" (
    "id" UUID NOT NULL,
    "torre_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_unidad" (
    "usuario_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_unidad_pkey" PRIMARY KEY ("usuario_id","unidad_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "torre_nombre_key" ON "torre"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_codigo_key" ON "unidad"("codigo");

-- CreateIndex
CREATE INDEX "unidad_torre_id_idx" ON "unidad"("torre_id");

-- CreateIndex
CREATE INDEX "usuario_unidad_unidad_id_idx" ON "usuario_unidad"("unidad_id");

-- AddForeignKey
ALTER TABLE "unidad" ADD CONSTRAINT "unidad_torre_id_fkey" FOREIGN KEY ("torre_id") REFERENCES "torre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidad" ADD CONSTRAINT "usuario_unidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_unidad" ADD CONSTRAINT "usuario_unidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
