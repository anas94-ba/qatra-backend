import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CreateConfigDto } from './dto';
import { RecommendationsService } from './recommendations.service';

@Roles(Role.ORG)
@Controller('org/plans/:planId/recommendations')
export class RecommendationsController {
  constructor(private svc: RecommendationsService) {}
  @Post() @HttpCode(200) generate(@CurrentUser() u: AuthUser, @Param('planId') planId: string) { return this.svc.generate(u, planId); }
  @Get() list(@CurrentUser() u: AuthUser, @Param('planId') planId: string) { return this.svc.list(u, planId); }
}

@Roles(Role.ADMIN)
@Controller('admin/algorithm-config')
export class AlgorithmConfigController {
  constructor(private svc: RecommendationsService) {}
  @Get() list() { return this.svc.configs(); }
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateConfigDto) {
    const w = dto.weights;
    if (w.gap + w.vulnerability + w.daysSince + w.population <= 0) throw new BadRequestException('مجموع الأوزان يجب أن يكون أكبر من صفر');
    return this.svc.createConfig(u.id, { ...w }, dto.referenceLpcd);
  }
}
