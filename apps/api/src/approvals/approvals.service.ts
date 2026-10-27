import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types';
import { sanitizeText } from '../common/text';
import { PlansService } from '../organizations/plans.service';
import { PrismaService } from '../prisma/prisma.service';

export class ApprovalItemDto {
  @IsString() recommendationId: string;
  /** بدون قيمة = اعتماد التوصية كما هي */
  @IsOptional() @IsInt() @Min(0) approvedLiters?: number;
  @IsOptional() @IsString() adjustmentReason?: string;
}
export class ApproveRecommendationsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ApprovalItemDto) items: ApprovalItemDto[];
}

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService, private plans: PlansService, private audit: AuditService) {}

  /** اعتماد أو تعديل الكميات: سبب التعديل إلزامي ويُحفظ الفرق (TC40، TC41) */
  async approve(u: AuthUser, planId: string, dto: ApproveRecommendationsDto) {
    const plan = await this.plans.getOwned(u, planId);
    if (plan.status === 'COMPLETED') throw new ConflictException('الخطة مكتملة');
    const recs = await this.prisma.recommendation.findMany({ where: { planId, id: { in: dto.items.map((i) => i.recommendationId) } }, include: { approval: true } });
    if (recs.length !== new Set(dto.items.map((i) => i.recommendationId)).size) throw new NotFoundException('بعض التوصيات لا تتبع هذه الخطة');

    const prepared = dto.items.map((item) => {
      const rec = recs.find((r) => r.id === item.recommendationId)!;
      if (rec.approval) throw new ConflictException('اعتُمدت إحدى التوصيات مسبقًا');
      const approved = item.approvedLiters ?? rec.suggestedLiters;
      const reason = item.adjustmentReason ? sanitizeText(item.adjustmentReason) : '';
      if (approved !== rec.suggestedLiters && reason.length < 3) throw new BadRequestException('سبب التعديل إلزامي عند تغيير الكمية');
      return { rec, approved, reason };
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const p of prepared) {
        const a = await tx.approval.create({ data: { recommendationId: p.rec.id, approvedLiters: p.approved, adjustmentReason: p.reason || null, approvedById: u.id } });
        await this.audit.log({ userId: u.id, action: p.approved === p.rec.suggestedLiters ? 'APPROVE_AS_IS' : 'APPROVE_ADJUSTED', entity: 'Approval', entityId: a.id, before: { suggestedLiters: p.rec.suggestedLiters }, after: { approvedLiters: p.approved, difference: p.approved - p.rec.suggestedLiters, reason: p.reason || null } }, tx);
        out.push({ ...a, suggestedLiters: p.rec.suggestedLiters, difference: p.approved - p.rec.suggestedLiters });
      }
      return out;
    });
    const total = created.reduce((s, a) => s + a.approvedLiters, 0);
    return { approvals: created, totalApprovedLiters: total, warnings: total > plan.dailyLiters ? ['مجموع الكميات المعتمدة يتجاوز الكمية اليومية المتاحة في الخطة'] : [] };
  }
}
