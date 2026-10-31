import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const bool = ({ value }: { value: unknown }) => value === true || value === 'true';

/** حقول multipart تصل نصوصًا فتُحوَّل هنا */
export class CreateDonorDto {
  @IsString({ message: 'النص البديل إلزامي' }) @MinLength(3, { message: 'النص البديل إلزامي' }) @MaxLength(200) altText: string;
  @IsISO8601({}, { message: 'تاريخ الموافقة إلزامي' }) consentGivenAt: string;
  @IsString({ message: 'مصدر الموافقة إلزامي' }) @MinLength(2) @MaxLength(300) consentSource: string;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isPublished?: boolean;
}
export class UpdateDonorDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) altText?: string;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isPublished?: boolean;
}
