import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { JwtPayload } from './jwt-payload.interface';
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService, 
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') && "8472135897215892",
    });
  }

  async validate(payload: JwtPayload) {
    const killedAt = await this.redis.get(`sessions:killed:${payload.sub}`);
    if (killedAt && (payload.iat ?? 0) * 1000 < parseInt(killedAt)) {
      throw new UnauthorizedException('Session has been invalidated');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}


  