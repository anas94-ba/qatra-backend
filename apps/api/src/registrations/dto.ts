import { IsEmail, IsEnum, IsNumber, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { EntityType, OrgType } from '@prisma/client';

export class ResubmitDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MinLength(2) @MaxLength(120) contactName: string;
  @IsString() @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'رقم الهاتف غير صالح' }) phone: string;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
}

export class ApproveDto {
  /** تأكيد الأدمن لنوع الجهة عند القبول (للمؤسسات/المبادرات)؛ الافتراضي ما اقترحه المتقدم */
  @IsOptional() @IsEnum(OrgType, { message: 'نوع الجهة يجب أن يكون محلية أو دولية أو مبادرة' }) orgType?: OrgType;
}
export class RejectDto { @IsString({ message: 'سبب الرفض إلزامي' }) @MinLength(3, { message: 'سبب الرفض إلزامي' }) @MaxLength(1000) reason: string; }
export class HoldDto { @IsString() @MinLength(1) @MaxLength(1000) note: string; }

export class DirectAccountDto {
  @IsEnum(EntityType, { message: 'نوع الجهة إلزامي' }) entityType: EntityType;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MinLength(2) contactName: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() email: string;
  @IsString() @Matches(/^\+?[0-9\s-]{7,20}$/) phone: string;
}
