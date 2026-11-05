import { Module } from '@nestjs/common';
import { AutorizacionesController } from '@Autorizaciones/controllers';
import { AutorizacionRepository } from '@Autorizaciones/repositories';
import { AutorizacionesService, AutorizacionesVencimientoService } from '@Autorizaciones/services';
import { UnidadesModule } from '@Unidades';

@Module({
  imports: [UnidadesModule],
  controllers: [AutorizacionesController],
  providers: [AutorizacionesService, AutorizacionesVencimientoService, AutorizacionRepository],
})
export class AutorizacionesModule {}
