import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AllowAnyState, CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ApproveDto, DirectAccountDto, HoldDto, RegistrationQueryDto, RejectDto, ResubmitDto } from './dto';
import { RegistrationsService } from './registrations.service';

/** Request status pages for the applicant (pending / rejected): view and resubmit only */
@ApiTags('Registration (applicant)')
@ApiBearerAuth()
@Controller('registration')
export class RegistrationController {
  constructor(private svc: RegistrationsService) {}

  @AllowAnyState() @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.svc.myRequest(u.id); }

  @AllowAnyState() @Put('me')
  resubmit(@CurrentUser() u: AuthUser, @Body() dto: ResubmitDto) { return this.svc.resubmit(u.id, dto); }
}

@Roles(Role.ADMIN)
@ApiTags('Admin - Registrations')
@ApiBearerAuth()
@Controller('admin')
export class AdminRegistrationsController {
  constructor(private svc: RegistrationsService) {}

  @Get('registrations')
  list(@Query() query: RegistrationQueryDto) {
    return this.svc.list(query);
  }

  @Get('registrations/:id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post('registrations/:id/approve') @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ApproveDto) { return this.svc.approve(u.id, id, dto.orgType); }

  @Post('registrations/:id/reject') @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RejectDto) { return this.svc.reject(u.id, id, dto.reason); }

  @Post('registrations/:id/hold') @HttpCode(200)
  hold(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: HoldDto) { return this.svc.hold(u.id, id, dto.note); }

  @Post('registrations/:id/extra-attempt') @HttpCode(200)
  extra(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.grantExtraAttempt(u.id, id); }

  @Post('accounts')
  createDirect(@CurrentUser() u: AuthUser, @Body() dto: DirectAccountDto) { return this.svc.createDirectAccount(u.id, dto); }
}
