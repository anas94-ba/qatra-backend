import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';

export class WeightsDto {
  @IsNumber() @Min(0) @Max(1) gap: number;
  @IsNumber() @Min(0) @Max(1) vulnerability: number;
  @IsNumber() @Min(0) @Max(1) daysSince: number;
  @IsNumber() @Min(0) @Max(1) population: number;
}
export class CreateConfigDto {
  @ValidateNested() @Type(() => WeightsDto) weights: WeightsDto;
  @IsInt() @Min(5) @Max(50) referenceLpcd: number;
}
