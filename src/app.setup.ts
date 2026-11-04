import { ValidationPipe, type INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api/v1';

/**
 * Configuración HTTP compartida entre producción (main.ts) y los e2e, para que
 * las pruebas ejerciten exactamente el mismo prefijo y validación.
 */
export function configureApp(app: INestApplication): void {
  // Versionado en la URI: /api/v1/...
  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta propiedades que no estén en el DTO...
      whitelist: true,
      // ...y además rechaza la request con 400 si vienen de más, en vez de
      // ignorarlas en silencio.
      forbidNonWhitelisted: true,
      // Convierte el payload al tipo del DTO (los query/params llegan string).
      transform: true,
    }),
  );
}
