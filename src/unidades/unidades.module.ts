import { Module } from '@nestjs/common';
import { UnidadesController } from '@Unidades/controllers';
import { UnidadRepository } from '@Unidades/repositories';

@Module({
  controllers: [UnidadesController],
  providers: [UnidadRepository],
  // Otros módulos (estado de cuenta, autorizaciones) reutilizan la consulta.
  exports: [UnidadRepository],
})
export class UnidadesModule {}
