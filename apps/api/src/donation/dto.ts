import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DonationLinkType } from '@prisma/client';

export class UpdateDonationLinkDto {
  @IsEnum(DonationLinkType) linkType: DonationLinkType;
  @IsString() @MaxLength(500) url: string;
  @IsOptional() @IsString() @MaxLength(30) whatsappNumber?: string;
  @IsString() @MinLength(2) @MaxLength(150) receivingEntityName: string;
  @IsString() @MinLength(2) @MaxLength(1000) description: string;
  @IsBoolean() isActive: boolean;
  /** إعادة المصادقة عند تغيير الرابط (TC73) */
  @IsString() password: string;
}
