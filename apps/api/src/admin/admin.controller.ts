import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ResolveFrozenDto, SuspendDto } from './dto';
import { SuspensionService } from './suspension.service';

/** Suspension and reactivation are admin-only (TC129) */
@Roles(Role.ADMIN)
@ApiTags('Admin - Suspension')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private svc: SuspensionService) {}

  @Post('camps/:id/suspend') @HttpCode(200)
  suspendCamp(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SuspendDto) { return this.svc.suspend(u.id, 'camp', id, dto.reason); }

  @Post('camps/:id/reactivate') @HttpCode(200)
  reactivateCamp(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.reactivate(u.id, 'camp', id); }

  @Post('organizations/:id/suspend') @HttpCode(200)
  suspendOrg(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SuspendDto) { return this.svc.suspend(u.id, 'org', id, dto.reason); }

  @Post('organizations/:id/reactivate') @HttpCode(200)
  reactivateOrg(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.reactivate(u.id, 'org', id); }

  @Post('deliveries/:id/resolve-frozen') @HttpCode(200)
  resolveFrozen(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResolveFrozenDto) { return this.svc.resolveFrozen(u.id, id, dto.action, dto.note); }

  @Post('users/:id/reset-password') @HttpCode(200)
  resetPassword(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.resetUserPassword(u.id, id); }
}
