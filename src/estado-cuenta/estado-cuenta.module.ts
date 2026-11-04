import { Module } from '@nestjs/common';
import { EstadoCuentaController } from '@EstadoCuenta/controllers';
import { CuotasVencimientoService, EstadoCuentaService } from '@EstadoCuenta/services';
import { CuotaRepository } from '@EstadoCuenta/repositories';

@Module({
  controllers: [EstadoCuentaController],
  providers: [EstadoCuentaService, CuotasVencimientoService, CuotaRepository],
})
export class EstadoCuentaModule {}
