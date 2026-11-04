import { SetMetadata } from '@nestjs/common';
import type { Rol } from '@PrismaClient';

export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta (o un controlador) a los roles indicados.
 *
 * Sin este decorador la ruta solo exige estar autenticado. Lo evalúa
 * RolesGuard, que corre después de JwtAuthGuard.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
