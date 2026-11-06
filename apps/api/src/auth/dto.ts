import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsEnum, IsNumber, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EntityType } from '@prisma/client';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @IsEnum(EntityType, { message: 'نوع الجهة غير صالح' }) entityType: EntityType;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MinLength(2) @MaxLength(120) contactName: string;
  @Transform(lower) @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' }) email: string;
  @IsString() @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'رقم الهاتف غير صالح' }) phone: string;
  @IsString() password: string;
  @IsString() passwordConfirm: string;
  @Equals(true, { message: 'يجب الموافقة على سياسة الخصوصية' }) privacyAccepted: boolean;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
  @IsOptional() @IsString() captchaToken?: string;
}

export class VerifyEmailDto { @IsString() token: string; }
export class EmailDto { @Transform(lower) @IsEmail() email: string; }
export class LoginDto {
  @Transform(lower) @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
}
export class RefreshDto { @IsString() refreshToken: string; }
export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() newPassword: string;
}
export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() newPassword: string;
  @IsString() newPasswordConfirm: string;
}
