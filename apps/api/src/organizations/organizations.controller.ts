import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { PaginationDto, paginate } from '../common/pagination';
import { AuthUser } from '../common/types';
import { sanitizeText } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeOrgTypeDto, CreatePlanDto, OrgsQueryDto, TransitionDto, UpdateOrgDto, UpdatePlanDto } from './dto';
import { PlansService } from './plans.service';

@Roles(Role.ORG)
@ApiTags('Organization')
@ApiBearerAuth()
@Controller('org')
export class OrgController {
  constructor(private prisma: PrismaService, private plans: PlansService, private audit: AuditService) {}

  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    return this.prisma.organization.findFirst({ where: { id: u.organizationId, deletedAt: null } });
  }

  @Patch('me')
  async update(@CurrentUser() u: AuthUser, @Body() dto: UpdateOrgDto) {
    if (dto.orgType !== undefined) throw new ForbiddenException('لا يمكن للمؤسسة تعديل نوعها. يؤكده الأدمن عند القبول.');
    const before = await this.prisma.organization.findUnique({ where: { id: u.organizationId } });
    const after = await this.prisma.organization.update({
      where: { id: u.organizationId },
      data: { description: dto.description ? sanitizeText(dto.description) : undefined, contact: dto.contact ? sanitizeText(dto.contact) : undefined },
    });
    await this.audit.log({ userId: u.id, action: 'UPDATE', entity: 'Organization', entityId: after.id, before, after });
    return after;
  }

  @Post('plans') create(@CurrentUser() u: AuthUser, @Body() dto: CreatePlanDto) { return this.plans.create(u, dto); }
  @Get('plans') list(@CurrentUser() u: AuthUser, @Query() query: PaginationDto) { return this.plans.list(u, query); }
  @Get('plans/:id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.plans.get(u, id); }
  @Patch('plans/:id') updatePlan(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePlanDto) { return this.plans.update(u, id, dto); }
  @Post('plans/:id/transition') @HttpCode(200) transition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TransitionDto) { return this.plans.transition(u, id, dto.to); }
  @Get('plans/:id/coordination') coordination(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.plans.coordination(u, id); }
}

@Roles(Role.ADMIN)
@ApiTags('Admin - Organizations')
@ApiBearerAuth()
@Controller('admin/organizations')
export class AdminOrgsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Filter entities by type (I3) */
  @Get()
  list(@Query() q: OrgsQueryDto) {
    const where: Prisma.OrganizationWhereInput = { deletedAt: null, orgType: q.orgType, status: q.status };
    return paginate(
      this.prisma,
      q,
      (window) => this.prisma.organization.findMany({ where, orderBy: { name: 'asc' }, ...window }),
      () => this.prisma.organization.count({ where }),
    );
  }

  @Patch(':id/type')
  async changeType(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ChangeOrgTypeDto) {
    const before = await this.prisma.organization.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.organization.update({ where: { id }, data: { orgType: dto.orgType } });
    await this.audit.log({ userId: u.id, action: 'CHANGE_TYPE', entity: 'Organization', entityId: id, before: { orgType: before.orgType }, after: { orgType: after.orgType } });
    return after;
  }
}
