-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('DUI', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "estado_autorizacion" AS ENUM ('VIGENTE', 'USADA', 'CANCELADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "autorizacion_visita" (
    "id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "residente_id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "tipo_documento" "tipo_documento" NOT NULL,
    "numero_documento" VARCHAR(12) NOT NULL,
    "placa" VARCHAR(10),
    "fecha_visita" DATE NOT NULL,
    "hora_estimada" TIME(0) NOT NULL,
    "codigo" CHAR(6) NOT NULL,
    "estado" "estado_autorizacion" NOT NULL DEFAULT 'VIGENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autorizacion_visita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "autorizacion_visita_residente_id_fecha_visita_idx" ON "autorizacion_visita"("residente_id", "fecha_visita");

-- CreateIndex
CREATE UNIQUE INDEX "autorizacion_visita_codigo_fecha_visita_key" ON "autorizacion_visita"("codigo", "fecha_visita");

-- AddForeignKey
ALTER TABLE "autorizacion_visita" ADD CONSTRAINT "autorizacion_visita_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacion_visita" ADD CONSTRAINT "autorizacion_visita_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
