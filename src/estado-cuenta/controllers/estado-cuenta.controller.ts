import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { EstadoCuentaService } from '@EstadoCuenta/services';
import { EstadoCuentaQueryDto, EstadoCuentaResponseDto } from '@EstadoCuenta/dto';
import { Rol, type User } from '@PrismaClient';

@ApiTags('estado-cuenta')
@Controller('estado-cuenta')
export class EstadoCuentaController {
  constructor(private readonly service: EstadoCuentaService) {}

  @Get()
  @Roles(Rol.RESIDENTE)
  @ApiOperation({ summary: 'Estado de cuenta de una unidad del residente' })
  @ApiOkResponse({ type: EstadoCuentaResponseDto })
  @ApiBadRequestResponse({ description: 'Parámetros inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión.' })
  @ApiForbiddenResponse({ description: 'Rol no permitido o unidad ajena.' })
  consultar(@CurrentUser() user: User, @Query() query: EstadoCuentaQueryDto): Promise<EstadoCuentaResponseDto> {
    return this.service.consultar(user.id, query);
  }
}
