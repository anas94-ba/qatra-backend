import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { DeliveryStatus, Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ConfirmDeliveryDto, CorrectDeliveryDto, CreateDeliveryDto, RejectDeliveryDto, UpdateDeliveryDto } from './dto';
import { DeliveriesService, DeliveryQuery } from './deliveries.service';

const q = (status?: DeliveryStatus, from?: string, to?: string, counterpartyId?: string, page?: string, pageSize?: string): DeliveryQuery => ({
  status, from, to, counterpartyId, page: page ? +page : undefined, pageSize: pageSize ? +pageSize : undefined,
});
function sendCsv(res: Response, csv: string, name: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  return csv;
}

@Roles(Role.ORG)
@Controller('org/deliveries')
export class OrgDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateDeliveryDto) { return this.svc.create(u, dto); }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: DeliveryStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('campId') campId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.outgoing(u, q(status, from, to, campId, page, pageSize));
  }

  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response, @Query('status') status?: DeliveryStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('campId') campId?: string) {
    return sendCsv(res, (await this.svc.outgoing(u, q(status, from, to, campId), true)) as string, 'outgoing-deliveries');
  }

  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDeliveryDto) { return this.svc.update(u, id, dto); }
  @Post(':id/cancel') @HttpCode(200) cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.cancel(u, id); }
}

@Roles(Role.CAMP_REP)
@Controller('camp/deliveries')
export class CampDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: DeliveryStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('orgId') orgId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.incoming(u, q(status, from, to, orgId, page, pageSize));
  }

  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response, @Query('status') status?: DeliveryStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('orgId') orgId?: string) {
    return sendCsv(res, (await this.svc.incoming(u, q(status, from, to, orgId), true)) as string, 'incoming-deliveries');
  }

  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.getForCamp(u, id); }
  @Post(':id/confirm') @HttpCode(200) confirm(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ConfirmDeliveryDto) { return this.svc.confirm(u, id, dto); }
  @Post(':id/reject') @HttpCode(200) reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RejectDeliveryDto) { return this.svc.reject(u, id, dto.reason); }
}

@Roles(Role.ADMIN)
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Get()
  list(@Query('status') status?: DeliveryStatus, @Query('disputed') disputed?: string, @Query('orgType') orgType?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('page') page?: string) {
    return this.svc.adminList({ status, disputed, orgType, from, to, page: page ? +page : undefined });
  }
  @Patch(':id/correct') correct(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CorrectDeliveryDto) { return this.svc.correct(u.id, id, dto); }
}
