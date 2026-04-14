import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { AlertType } from '@prisma/client';

export class CreateAlertRuleDto {
  @ApiProperty({ example: 'uuid-of-tracked-item' })
  @IsUUID()
  tracked_item_id: string;

  @ApiProperty({ enum: AlertType })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiProperty({ example: 10, description: '% for PERCENTAGE_DROP, target EGP for TARGET_PRICE' })
  @IsNumber()
  @Min(0.01)
  @Max(9_999_999)
  threshold: number;
}
