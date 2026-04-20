import { Controller, Post, Body, Req, Res, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from '././dto/register.dto';
import { LoginDto } from '././dto/login.dto';
import { SocialExchangeDto } from './dto/social-exchange.dto';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { extractIp } from '../common/helpers/ip.helper';
import { ReferralService } from '../referrals/referrals.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { AuthGuard } from '@nestjs/passport';
import { SocialAuthRequestUser } from './auth.types';

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
    const { accessToken, refreshToken, referralCode } = await this.auth.register(dto);
    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
    return { access_token: accessToken, referralCode };
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
    return { access_token: accessToken, referralCode };
  }

  @Public()
  @Throttle({ default: { ttl: 60, limit: 20 } })
  @Get('google')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Start Google OAuth login' })
  googleAuth() {}

  @Public()
  @Throttle({ default: { ttl: 60, limit: 20 } })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Complete Google OAuth login' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.completeOauth(req, res);
  }

  @Public()
  @Post('social/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time social auth code for tokens' })
  async exchangeSocialCode(@Body() dto: SocialExchangeDto) {
    const { accessToken, refreshToken, referralCode } = await this.auth.exchangeSocialCode(dto.code);
    return { access_token: accessToken, refresh_token: refreshToken, referralCode };
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
    return { access_token: accessToken, referralCode };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await this.auth.logout(token);
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  @Get('referral-summary')
  @ApiOperation({ summary: 'Get referral progress and current referral code' })
  async getReferralSummary(@CurrentUser('id') userId: string) {
    return this.referrals.getReferralSummary(userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  getCurrentUser(@CurrentUser() user: { id: string; email: string; role: string; auth_provider?: string }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      authProvider: user.auth_provider,
    };
  }

  private async completeOauth(req: Request, res: Response) {
    const user = req.user as SocialAuthRequestUser | undefined;
    if (!user) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?socialError=missing_profile`);
    }

    const code = await this.auth.createSocialExchangeCode(user);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/api/auth/social/callback?code=${encodeURIComponent(code)}`);
  }
}
