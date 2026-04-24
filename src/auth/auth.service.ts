import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  HttpException,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '.././prisma/prisma.service';
import { REDIS_CLIENT } from '.././redis/redis.module';
import Redis from 'ioredis';
import { RegisterDto } from '././dto/register.dto';
import { LoginDto } from '././dto/login.dto';
import { JwtPayload } from '././strategies/jwt-payload.interface';
import { User, SecurityEventType } from '@prisma/client';
import { SecurityEventService } from '../security/security-event.service';
import { ReferralService } from '../referrals/referrals.service';
import { SOCIAL_EXCHANGE_TTL_SECONDS } from './auth.constants';
import { SocialAuthRequestUser, SocialProfile } from './auth.types';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFRESH_REUSE_RESULT_TTL_SECONDS = 15;
const REFRESH_ROTATION_LOCK_TTL_SECONDS = 5;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  referralCode: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private securityEvents: SecurityEventService,
    private referrals: ReferralService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const normalizedReferralCode = this.referrals.normalizeReferralCode(dto.referralCode);
    const referrer = normalizedReferralCode
      ? await this.referrals.assertValidReferralCode(normalizedReferralCode)
      : null;

    if (referrer?.email === dto.email) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    const { user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.email },
      });

      const referralCode = await this.generateUniqueReferralCode();

      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password_hash: passwordHash,
          referral_code: referralCode,
          referred_by_user_id: referrer?.id ?? null,
          tenant_id: tenant.id,
          role: 'OWNER',
        },
      });

      return { user: newUser };
    });

    return this.generateTokens(user);
  }

  async socialAuthFromProfile(profile: SocialProfile, referralCode?: string): Promise<AuthTokens> {
    const normalizedReferralCode = this.referrals.normalizeReferralCode(referralCode);
    const referrer = normalizedReferralCode
      ? await this.referrals.assertValidReferralCode(normalizedReferralCode)
      : null;

    if (referrer?.email === profile.email) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const existingByProvider = await tx.user.findFirst({
        where: { google_id: profile.providerUserId },
      });

      if (existingByProvider) {
        return existingByProvider;
      }

      const existingByEmail = await tx.user.findUnique({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        this.assertSocialEmailCanBeUsed(existingByEmail, profile);

        return tx.user.update({
          where: { id: existingByEmail.id },
          data: { google_id: profile.providerUserId },
        });
      }

      const tenant = await tx.tenant.create({
        data: { name: profile.name || profile.email },
      });

      const referralCode = await this.generateUniqueReferralCode();

      return tx.user.create({
        data: {
          email: profile.email,
          password_hash: null,
          auth_provider: 'GOOGLE',
          google_id: profile.providerUserId,
          referral_code: referralCode,
          referred_by_user_id: referrer?.id ?? null,
          tenant_id: tenant.id,
          role: 'OWNER',
        },
      });
    });

    return this.generateTokens(user);
  }

  async createSocialExchangeCode(user: SocialAuthRequestUser): Promise<string> {
    const tokens = await this.socialAuthFromProfile(user, user.referralCode);
    const code = randomBytes(24).toString('hex');

    await this.redis.set(
      `social:exchange:${code}`,
      JSON.stringify(tokens),
      'EX',
      SOCIAL_EXCHANGE_TTL_SECONDS,
    );

    return code;
  }

  async exchangeSocialCode(code: string): Promise<AuthTokens> {
    const key = `social:exchange:${code}`;
    const value = await this.redis.get(key);

    if (!value) {
      throw new UnauthorizedException('Social login session expired. Please try again.');
    }

    await this.redis.del(key);
    return JSON.parse(value) as AuthTokens;
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user?.locked_until && new Date() < user.locked_until) {
      throw new HttpException(
        { message: 'Account is temporarily locked', unlocksAt: user.locked_until },
        423,
      );
    }

    if (user && !user.password_hash) {
      throw new UnauthorizedException('This account uses Google login. Continue with Google.');
    }

    const valid = user?.password_hash
      ? await bcrypt.compare(dto.password, user.password_hash)
      : false;

    if (!user || !valid) {
      this.securityEvents.log({
        event_type: SecurityEventType.FAILED_LOGIN,
        user_id: user?.id,
        ip: ip,
        user_agent: userAgent,
      });
      if (user) {
        const attempts = await this.incrementFailedAttempts(ip, user.id);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { locked_until: lockedUntil, failed_attempts: attempts },
          });
          this.securityEvents.log({
            event_type: SecurityEventType.ACCOUNT_LOCKOUT,
            user_id: user?.id,
            ip: ip,
            user_agent: userAgent,
          });
          throw new HttpException(
            { message: 'Account locked due to too many failed attempts', unlocksAt: lockedUntil },
            423,
          );
        }
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearFailedAttempts(ip, user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failed_attempts: 0, locked_until: null },
    });

    return this.generateTokens(user);
  }

  async refreshTokens(
    oldRefreshToken: string,
    ip: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(oldRefreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(oldRefreshToken);
    const reuseResultKey = `rt:result:${tokenHash}`;
    const lockKey = `rt:lock:${tokenHash}`;

    const reusableResult = await this.getReusableRefreshResult(reuseResultKey);
    if (reusableResult) {
      return reusableResult;
    }

    const lockAcquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      REFRESH_ROTATION_LOCK_TTL_SECONDS,
      'NX',
    );

    if (!lockAcquired) {
      const pendingResult = await this.waitForRefreshResult(reuseResultKey);
      if (pendingResult) {
        return pendingResult;
      }
    }

    const blacklisted = await this.redis.get(`rt:blacklist:${tokenHash}`);
    if (blacklisted) {
      this.securityEvents.log({
        event_type: SecurityEventType.TOKEN_REUSE,
        user_id: payload.sub,
        ip: ip,
        user_agent: userAgent,
      });
      await this.redis.set(
        `sessions:killed:${payload.sub}`,
        Date.now().toString(),
        'EX',
        7 * 24 * 3600,
      );
      throw new UnauthorizedException('Token reuse detected - all sessions invalidated');
    }

    try {
      const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
      await this.redis.set(`rt:blacklist:${tokenHash}`, '1', 'EX', Math.max(ttl, 1));

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();

      const tokens = this.generateTokens(user);
      await this.redis.set(
        reuseResultKey,
        JSON.stringify(tokens),
        'EX',
        REFRESH_REUSE_RESULT_TTL_SECONDS,
      );

      return tokens;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.redis.set(`rt:blacklist:${hash}`, '1', 'EX', 7 * 24 * 3600);
  }

  generateTokens(user: User): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      referralCode: user.referral_code,
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async getReusableRefreshResult(key: string): Promise<AuthTokens | null> {
    const cached = await this.redis.get(key);
    return cached ? (JSON.parse(cached) as AuthTokens) : null;
  }

  private async waitForRefreshResult(key: string): Promise<AuthTokens | null> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await this.delay(100);
      const cached = await this.getReusableRefreshResult(key);
      if (cached) {
        return cached;
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async incrementFailedAttempts(
    ip: string,
    userId: string,
  ): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(`bf:ip:${ip}`);
    pipeline.expire(`bf:ip:${ip}`, LOCKOUT_MINUTES * 60);
    pipeline.incr(`bf:account:${userId}`);
    pipeline.expire(`bf:account:${userId}`, LOCKOUT_MINUTES * 60);
    const results = await pipeline.exec();
    const ipCount = (results?.[0]?.[1] as number) ?? 0;
    const accCount = (results?.[2]?.[1] as number) ?? 0;
    return Math.max(ipCount, accCount);
  }

  private async clearFailedAttempts(ip: string, userId: string): Promise<void> {
    await this.redis.del(`bf:ip:${ip}`, `bf:account:${userId}`);
  }

  private async generateUniqueReferralCode(length = 10): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const bytes = randomBytes(length);
      const referralCode = Array.from(bytes, (byte) =>
        REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length],
      ).join('');

      const existingUser = await this.prisma.user.findUnique({
        where: { referral_code: referralCode },
        select: { id: true },
      });

      if (!existingUser) {
        return referralCode;
      }
    }

    throw new InternalServerErrorException('Unable to generate a unique referral code');
  }

  private assertSocialEmailCanBeUsed(user: User, _profile: SocialProfile): void {
    if (user.auth_provider === 'LOCAL') {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED_WITH_PASSWORD',
        message: 'This email already has a password-based account. Sign in with email and password.',
      });
    }

    if (user.auth_provider === 'GOOGLE') {
      return;
    }

    throw new ConflictException({
      code: 'EMAIL_ALREADY_REGISTERED_WITH_UNSUPPORTED_PROVIDER',
      message: 'This email is already registered with an unsupported provider. Contact support to continue.',
    });
  }
}
