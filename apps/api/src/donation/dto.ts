import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DonationLinkType } from '@prisma/client';

export class UpdateDonationLinkDto {
  @IsEnum(DonationLinkType) linkType: DonationLinkType;
  @IsString() @MaxLength(500) url: string;
  @IsOptional() @IsString() @MaxLength(30) whatsappNumber?: string;
  @IsString() @MinLength(2) @MaxLength(150) receivingEntityName: string;
  @IsString() @MinLength(2) @MaxLength(1000) description: string;
  @IsBoolean() isActive: boolean;
  /** Re-authentication when changing the link (TC73) */
  @IsString() password: string;
}
