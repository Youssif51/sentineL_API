import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class CreateTrackedItemDto {
  @ApiProperty({ example: 'https://sigma-computer.com/product/rtx-4070' })
  @IsUrl({ require_tld: true, protocols: ['http', 'https'] })
  url: string;
}
