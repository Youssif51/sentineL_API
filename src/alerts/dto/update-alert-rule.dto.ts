import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAlertRuleDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(0.01)
  @Max(9_999_999)
  @IsOptional()
  threshold?: number;
}
