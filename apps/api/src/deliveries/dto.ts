import { DeliveryStatus, OrgType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateDeliveryDto {
  @IsString() planId: string;
  @IsString() campId: string;
  @IsInt() @Min(1, { message: 'الكمية يجب أن تكون أكبر من صفر' }) @Max(100_000_000) sentLiters: number;
  @Matches(DATE, { message: 'صيغة التاريخ YYYY-MM-DD' }) sentAt: string;
  @IsString() @MinLength(2) @MaxLength(150) executor: string;
  @IsOptional() @IsString() @MaxLength(500) proofUrl?: string;
}
export class UpdateDeliveryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100_000_000) sentLiters?: number;
  @IsOptional() @Matches(DATE) sentAt?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) executor?: string;
  @IsOptional() @IsString() @MaxLength(500) proofUrl?: string;
}
export class ConfirmDeliveryDto {
  /** No value = received the same quantity */
  @IsOptional() @IsInt() @Min(0) receivedLiters?: number;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class RejectDeliveryDto { @IsString({ message: 'سبب الرفض إلزامي' }) @MinLength(3, { message: 'سبب الرفض إلزامي' }) @MaxLength(1000) reason: string; }
export class CorrectDeliveryDto {
  @IsOptional() @IsInt() @Min(0) sentLiters?: number;
  @IsOptional() @IsInt() @Min(0) receivedLiters?: number;
  @IsOptional() @IsIn(['CONFIRMED', 'CONFIRMED_DIFF', 'REJECTED', 'CANCELLED']) status?: string;
  @IsString({ message: 'سبب التصحيح إلزامي' }) @MinLength(3) @MaxLength(1000) reason: string;
}

/** Log filters (incoming/outgoing/admin). `counterpartyId` is the other party: the camp for an organization, the organization for a camp. */
export class DeliveryQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(DeliveryStatus) status?: DeliveryStatus;
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsString() counterpartyId?: string;
  @IsOptional() @IsEnum(OrgType) orgType?: OrgType;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() disputed?: boolean;
}
