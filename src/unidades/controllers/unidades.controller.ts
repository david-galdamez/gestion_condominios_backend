import { Controller, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { UnidadResumenDto } from '@Unidades/dto';
import { UnidadRepository } from '@Unidades/repositories';
import { Rol, type User } from '@PrismaClient';

@ApiTags('unidades')
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidades: UnidadRepository) {}

  @Get('mias')
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Unidades del residente (para el selector)' })
  @ApiOkResponse({ type: UnidadResumenDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido.' })
  mias(@CurrentUser() user: User): Promise<UnidadResumenDto[]> {
    return this.unidades.findDeUsuario(user.id);
  }
}
