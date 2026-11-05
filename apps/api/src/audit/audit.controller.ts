import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators';
import { AuditQueryDto } from './dto';
import { AuditService } from './audit.service';

@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
