import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ApprovalItemDto {
  @IsString() recommendationId: string;
  /** No value = approve the recommendation as is */
  @IsOptional() @IsInt() @Min(0) approvedLiters?: number;
  @IsOptional() @IsString() adjustmentReason?: string;
}
export class ApproveRecommendationsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ApprovalItemDto) items: ApprovalItemDto[];
}
