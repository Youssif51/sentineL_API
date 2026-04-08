import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { ScraperRegistryService } from '../registry/scraper-registry.service';
import Redis from 'ioredis';

const HEALTH_PREFIX = 'scraper:health:';
const HEALTH_TTL = 35 * 60;

@Injectable()
export class ScraperHealthService {
  private readonly logger = new Logger(ScraperHealthService.name);

  constructor(
    private registry: ScraperRegistryService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  @Cron('*/30 * * * *')
  async checkAll(): Promise<void> {
    this.logger.log('Running scraper health checks...');
    const adapters = this.registry.getAllAdapters();

    await Promise.allSettled(
      adapters.map(async (adapter) => {
        const healthy = await adapter.isHealthy();
        await this.redis.set(`${HEALTH_PREFIX}${adapter.storeDomain}`, healthy ? '1' : '0', 'EX', HEALTH_TTL);
        this.logger.log(`${adapter.storeDomain}: ${healthy ? 'UP' : 'DOWN'}`);
      }),
    );
  }

  async getStatus(): Promise<Record<string, boolean>> {
    const adapters = this.registry.getAllAdapters();
    const entries = await Promise.all(
      adapters.map(async (a) => {
        const val = await this.redis.get(`${HEALTH_PREFIX}${a.storeDomain}`);
        return [a.storeDomain, val === '1'] as [string, boolean];
      }),
    );
    return Object.fromEntries(entries);
  }
}
