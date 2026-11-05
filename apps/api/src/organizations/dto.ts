import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EntityStatus, OrgType, PlanStatus } from '@prisma/client';
import { PaginationDto } from '../common/pagination';

export class UpdateOrgDto {
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(200) contact?: string;
  /** موجود لرصد المحاولة: المؤسسة لا تعدّل نوعها (TC91) فيُرفض بـ 403 */
  @IsOptional() @IsString() orgType?: string;
}
export class ChangeOrgTypeDto { @IsEnum(OrgType, { message: 'نوع الجهة إلزامي' }) orgType: OrgType; }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePlanDto {
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @IsInt() @Min(1) @Max(100_000_000) dailyLiters: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) campIds: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) regions?: string[];
  @Matches(DATE, { message: 'صيغة تاريخ البداية YYYY-MM-DD' }) startDate: string;
  @Matches(DATE, { message: 'صيغة تاريخ النهاية YYYY-MM-DD' }) endDate: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) distributionDays?: number[];
  @IsOptional() @IsObject() constraints?: Record<string, unknown>;
}
export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000_000) dailyLiters?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) campIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) regions?: string[];
  @IsOptional() @Matches(DATE) startDate?: string;
  @IsOptional() @Matches(DATE) endDate?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) distributionDays?: number[];
  @IsOptional() @IsObject() constraints?: Record<string, unknown>;
}
export class TransitionDto { @IsIn(['APPROVED', 'IN_PROGRESS', 'COMPLETED']) to: PlanStatus; }

export class OrgsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(OrgType) orgType?: OrgType;
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
}
