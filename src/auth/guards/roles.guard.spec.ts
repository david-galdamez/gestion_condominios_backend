import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '@PrismaClient';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const buildContext = (metadata: Record<string, unknown>, userRol?: Rol) => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      (key) => metadata[key as string] as never,
    );
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: userRol ? { rol: userRol } : undefined }),
      }),
    } as unknown as ExecutionContext;
  };

  afterEach(() => vi.restoreAllMocks());

  it('deja pasar si la ruta no tiene @Roles', () => {
    expect(guard.canActivate(buildContext({}, Rol.RESIDENTE))).toBe(true);
  });

  it('deja pasar si el rol está permitido', () => {
    const ctx = buildContext({ [ROLES_KEY]: [Rol.ADMINISTRADOR] }, Rol.ADMINISTRADOR);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('lanza 403 si el rol no está permitido', () => {
    const ctx = buildContext({ [ROLES_KEY]: [Rol.ADMINISTRADOR] }, Rol.RESIDENTE);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('No tienes permiso para esta acción');
  });

  it('deja pasar rutas públicas aunque tengan @Roles', () => {
    const ctx = buildContext({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: [Rol.ADMINISTRADOR] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
