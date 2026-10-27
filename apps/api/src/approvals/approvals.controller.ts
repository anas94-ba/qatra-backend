import { Body, Controller, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ApprovalsService, ApproveRecommendationsDto } from './approvals.service';

@Roles(Role.ORG)
@Controller('org/plans/:planId/approvals')
export class ApprovalsController {
  constructor(private svc: ApprovalsService) {}
  @Post() approve(@CurrentUser() u: AuthUser, @Param('planId') planId: string, @Body() dto: ApproveRecommendationsDto) { return this.svc.approve(u, planId, dto); }
}
