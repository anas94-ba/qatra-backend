import { EntityStatus, ReviewStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class CreateCampDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MinLength(2) @MaxLength(120) region: string;
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsOptional() @IsBoolean() publicVisible?: boolean;
}
export class UpdateCampDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) region?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsBoolean() publicVisible?: boolean;
}
/** A camp manager edits only the descriptive data of their own camp */
export class UpdateOwnCampDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) region?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class CreateSnapshotDto {
  @IsInt() @Min(0) @Max(1_000_000) families: number;
  @IsInt() @Min(0) @Max(1_000_000) population: number;
  @IsInt() @Min(0) @Max(1_000_000) children: number;
  @IsInt() @Min(0) @Max(1_000_000) disabled: number;
  /** Liters per day reaching the camp from other sources (liters delivered through the platform are derived from confirmed deliveries) */
  @IsInt() @Min(0) @Max(100_000_000) waterReceivedLiters: number;
  @IsOptional() @IsISO8601({ strict: true }) lastDistributionAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) otherSources?: string;
  @IsISO8601() reportedAt: string;
  @IsString() @MinLength(2) @MaxLength(100) source: string;
}
export class ReviewSnapshotDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class CampsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() q?: string;
}
export class SnapshotsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(ReviewStatus) reviewStatus?: ReviewStatus;
  @IsOptional() @IsString() campId?: string;
}
