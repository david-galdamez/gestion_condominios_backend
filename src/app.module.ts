import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@Auth';
import { JwtAuthGuard, RolesGuard } from '@Auth/guards';
import { EstadoCuentaModule } from '@EstadoCuenta';
import { HealthModule } from '@Health';
import { PrismaModule } from '@Prisma';
import { UsersModule } from '@Users';
import { validateEnv } from '@Config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Si falta DATABASE_URL o JWT_SECRET, la app no arranca.
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    EstadoCuentaModule,
  ],
  providers: [
    {
      // Todo cerrado por defecto: las rutas públicas se abren con @Public().
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      // Debe ir después del JwtAuthGuard: necesita request.user ya cargado.
      provide: APP_GUARD,
      useExisting: RolesGuard,
    },
  ],
})
export class AppModule {}
