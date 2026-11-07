import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { DeliveriesService } from './deliveries.service';
import { ConfirmDeliveryDto, CorrectDeliveryDto, CreateDeliveryDto, DeliveryQueryDto, RejectDeliveryDto, UpdateDeliveryDto } from './dto';

function asCsv(res: Response, csv: string, filename: string): string {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  return csv;
}

@Roles(Role.ORG)
@ApiTags('Org - Deliveries')
@ApiBearerAuth()
@Controller('org/deliveries')
export class OrgDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateDeliveryDto) { return this.svc.create(u, dto); }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() query: DeliveryQueryDto) { return this.svc.outgoing(u, query); }

  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Query() query: DeliveryQueryDto, @Res({ passthrough: true }) res: Response) {
    return asCsv(res, await this.svc.exportCsv(u, query, 'out'), 'outgoing-deliveries');
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateDeliveryDto) { return this.svc.update(u, id, dto); }

  @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.cancel(u, id); }
}

@Roles(Role.CAMP_REP)
@ApiTags('Camp - Deliveries')
@ApiBearerAuth()
@Controller('camp/deliveries')
export class CampDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() query: DeliveryQueryDto) { return this.svc.incoming(u, query); }

  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Query() query: DeliveryQueryDto, @Res({ passthrough: true }) res: Response) {
    return asCsv(res, await this.svc.exportCsv(u, query, 'in'), 'incoming-deliveries');
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.getForCamp(u, id); }

  @Post(':id/confirm') @HttpCode(200)
  confirm(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ConfirmDeliveryDto) { return this.svc.confirm(u, id, dto); }

  @Post(':id/reject') @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RejectDeliveryDto) { return this.svc.reject(u, id, dto.reason); }
}

@Roles(Role.ADMIN)
@ApiTags('Admin - Deliveries')
@ApiBearerAuth()
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private svc: DeliveriesService) {}

  @Get()
  list(@Query() query: DeliveryQueryDto) { return this.svc.adminList(query); }

  @Patch(':id/correct')
  correct(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CorrectDeliveryDto) { return this.svc.correct(u.id, id, dto); }
}
