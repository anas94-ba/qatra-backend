import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class AuditQueryDto extends PaginationDto {
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
