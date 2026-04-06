import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../../redis/redis.module';
import Redis from 'ioredis';

interface DomainLimit { max: number; windowSeconds: number }

const LIMITS: Record<string, DomainLimit> = {
  'sigma-computer.com':  { max: 30, windowSeconds: 60 },
  'alfrensia.com':       { max: 30, windowSeconds: 60 },
  'elbadrgroupeg.store': { max: 20, windowSeconds: 60 },
  'kimostore.net':       { max: 20, windowSeconds: 60 },
  'gamesworldegypt.com': { max: 20, windowSeconds: 60 },
};
const DEFAULT_LIMIT: DomainLimit = { max: 20, windowSeconds: 60 };

@Injectable()
export class DomainRateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async checkAndIncrement(domain: string): Promise<void> {
    const { max, windowSeconds } = LIMITS[domain] ?? DEFAULT_LIMIT;
    const key = `scrape:rate:${domain}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSeconds);
    if (count > max) {
      throw new Error(`Domain rate limit exceeded for ${domain} (${count}/${max})`);
    }
  }
}
