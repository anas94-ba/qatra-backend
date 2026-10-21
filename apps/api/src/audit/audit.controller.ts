import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators';
import { AuditService } from './audit.service';

@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.list({ entity, entityId, userId, action, from, to, page: page ? +page : undefined, pageSize: pageSize ? +pageSize : undefined });
  }
}
