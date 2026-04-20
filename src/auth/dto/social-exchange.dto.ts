import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SocialExchangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  code: string;
}
