import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendDto { @IsString({ message: 'سبب التوقيف إلزامي' }) @MinLength(3, { message: 'سبب التوقيف إلزامي' }) @MaxLength(1000) reason: string; }
export class ResolveFrozenDto {
  @IsIn(['CANCEL', 'KEEP']) action: 'CANCEL' | 'KEEP';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
