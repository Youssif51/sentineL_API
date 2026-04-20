import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SocialTokenDto {
  @ApiProperty({
    description: 'Google ID token or Facebook access token from the frontend provider SDK',
  })
  @IsString()
  token: string;

  @ApiProperty({ example: 'ABCD2345EF', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{6,32}$/, {
    message: 'Referral code must contain only uppercase letters and numbers',
  })
  referralCode?: string;
}
