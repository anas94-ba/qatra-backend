import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class NotificationsQueryDto extends PaginationDto {
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  unread?: boolean;
}
