-- CreateEnum
CREATE TYPE "estado_cuota" AS ENUM ('PENDIENTE', 'VENCIDA', 'PAGADA');

-- CreateTable
CREATE TABLE "cuota" (
    "id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "estado" "estado_cuota" NOT NULL DEFAULT 'PENDIENTE',
    "pagada_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuota_unidad_id_estado_idx" ON "cuota"("unidad_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "cuota_unidad_id_periodo_key" ON "cuota"("unidad_id", "periodo");

-- AddForeignKey
ALTER TABLE "cuota" ADD CONSTRAINT "cuota_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regla de negocio: una cuota siempre tiene monto positivo.
ALTER TABLE "cuota" ADD CONSTRAINT "cuota_monto_positivo_chk" CHECK ("monto" > 0);
