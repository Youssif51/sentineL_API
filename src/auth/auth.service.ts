import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    HttpException,
    HttpStatus,
    Inject,
  } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { ConfigService } from '@nestjs/config';
  import * as bcrypt from 'bcrypt';
  import { createHash } from 'crypto';
  import { PrismaService } from '.././prisma/prisma.service';
import { REDIS_CLIENT } from '.././redis/redis.module';
  import Redis from 'ioredis';
  import { RegisterDto } from '././dto/register.dto';
  import { LoginDto } from '././dto/login.dto';
  import { JwtPayload } from '././strategies/jwt-payload.interface';
  import { User, SecurityEventType } from '@prisma/client';
  import { SecurityEventService } from '../security/security-event.service';
  

  const BCRYPT_ROUNDS = 12;
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;
  
  @Injectable()
  export class AuthService {
    constructor(
      private prisma: PrismaService,
      private jwt: JwtService,
      private config: ConfigService,
      @Inject(REDIS_CLIENT) private redis: Redis,
      private securityEvents: SecurityEventService,
    ) {}
  
    async register(dto: RegisterDto) {
        console.log('Inside Register Service');
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email already registered');
  
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
  
      const { user } = await this.prisma.$transaction(async (tx) => {

        const tenant = await tx.tenant.create({
          data: { name: dto.email },
        });
    
        const newUser = await tx.user.create({
          data: {
            email: dto.email,
            password_hash: passwordHash,
            tenant_id: tenant.id,
            role: 'OWNER',
          },
        });
    
        return { user: newUser };
      });
  
      return this.generateTokens(user);
    }
  
    async login(dto: LoginDto, ip: string, userAgent: string) { // ( adada498592 , 10.0.0.1)
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
  
      // Check DB lockout
      if (user?.locked_until && new Date() < user.locked_until) {
        throw new HttpException(
          { message: 'Account is temporarily locked', unlocksAt: user.locked_until },
          423, 
        );
      }
  
      const valid = user && (await bcrypt.compare(dto.password, user.password_hash)); // true
  
      if (!valid) {
        this.securityEvents.log({
          event_type: SecurityEventType.FAILED_LOGIN,
          user_id: user?.id,
          ip: ip,
          user_agent: userAgent,
        });
        if (user) {
          const attempts = await this.incrementFailedAttempts(ip, user.id, userAgent);
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
  
      // Successful login — clear counters
      await this.clearFailedAttempts(ip, user.id);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failed_attempts: 0, locked_until: null },
      });
  
      return this.generateTokens(user);
    }
  
    async refreshTokens(oldRefreshToken: string, ip: string, userAgent: string): Promise<{ accessToken: string; refreshToken: string }> {
      let payload: JwtPayload;
      try {
        payload = this.jwt.verify<JwtPayload>(oldRefreshToken, {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        });
      } catch {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
  
      const tokenHash = this.hashToken(oldRefreshToken);
      const blacklisted = await this.redis.get(`rt:blacklist:${tokenHash}`);
      if (blacklisted) {
        this.securityEvents.log({
          event_type: SecurityEventType.TOKEN_REUSE,
          user_id: payload.sub,
          ip: ip,
          user_agent: userAgent,
        });
        await this.redis.set(`sessions:killed:${payload.sub}`, Date.now().toString(), 'EX', 7 * 24 * 3600);
        throw new UnauthorizedException('Token reuse detected — all sessions invalidated');
      }
  
      const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000); // we divide by 1000 to get the seconds cuz node save in milliseconds
      await this.redis.set(`rt:blacklist:${tokenHash}`, '1', 'EX', Math.max(ttl, 1));
  
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
  
      return this.generateTokens(user);
    }
  
    async logout(refreshToken: string): Promise<void> {
      const hash = this.hashToken(refreshToken);
      await this.redis.set(`rt:blacklist:${hash}`, '1', 'EX', 7 * 24 * 3600);
    }
  
    generateTokens(user: User) {
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
  
      return { accessToken, refreshToken };
    }
  
    hashToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }
  
    private async incrementFailedAttempts(ip: string, userId: string, userAgent: string): Promise<number> {
      const pipeline = this.redis.pipeline();
      pipeline.incr(`bf:ip:${ip}`);
      pipeline.expire(`bf:ip:${ip}`, LOCKOUT_MINUTES * 60);
      pipeline.incr(`bf:account:${userId}`);
      pipeline.expire(`bf:account:${userId}`, LOCKOUT_MINUTES * 60);
      pipeline.incr(`bf:user_agent:${userAgent}`);
      pipeline.expire(`bf:user_agent:${userAgent}`, LOCKOUT_MINUTES * 60);
      const results = await pipeline.exec();
      const ipCount = (results?.[0]?.[1] as number) ?? 0;
      const accCount = (results?.[2]?.[1] as number) ?? 0;
      return Math.max(ipCount, accCount);
    }
  
    private async clearFailedAttempts(ip: string, userId: string): Promise<void> {
      await this.redis.del(`bf:ip:${ip}`, `bf:account:${userId}`);
    }
  }
  