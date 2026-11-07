import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ApprovalsService } from './approvals.service';
import { ApproveRecommendationsDto } from './dto';

@Roles(Role.ORG)
@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('org/plans/:planId/approvals')
export class ApprovalsController {
  constructor(private svc: ApprovalsService) {}
  @Post() approve(@CurrentUser() u: AuthUser, @Param('planId') planId: string, @Body() dto: ApproveRecommendationsDto) { return this.svc.approve(u, planId, dto); }
}
