import { Controller, Post, Body, Req, Res, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from '././dto/register.dto';
import { LoginDto } from '././dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { extractIp } from '../common/helpers/ip.helper';
import { ReferralService } from '../referrals/referrals.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private referrals: ReferralService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60, limit: 10 } })
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'Returns access token' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    console.log('Inside Register Controller');
    const { accessToken, refreshToken, referralCode } = await this.auth.register(dto);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return { accessToken, referralCode };
  }

  @Public()
  @Throttle({ default: { ttl: 60, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] as string;
    const { accessToken, refreshToken, referralCode } = await this.auth.login(dto, ip, userAgent);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return { message: 'Welcome to your Price Tracker profile!', accessToken, referralCode };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new Error('No refresh token');
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] as string;
    const { accessToken, refreshToken, referralCode } = await this.auth.refreshTokens(
      token,
      ip,
      userAgent,
    );
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return { accessToken, referralCode };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await this.auth.logout(token);
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  @Get('referral-summary')
  @ApiOperation({ summary: 'Get referral progress and current referral code' })
  async getReferralSummary(@CurrentUser('id') userId: string) {
    return this.referrals.getReferralSummary(userId);
  }
}
