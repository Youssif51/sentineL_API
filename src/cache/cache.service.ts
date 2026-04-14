import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '.././redis/redis.module';
import Redis from 'ioredis';

const TTL = {
  PRODUCT_PRICE: 5 * 60,
  CHART_DATA: 15 * 60,
  TENANT_PLAN: 60,
  DEALS: 10 * 60,
} as const;

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.redis.del(...keys);
  }

  async invalidateProductPrice(productId: string): Promise<void> {
    const chartKeys = await this.redis.keys(`cache:chart:${productId}:*`);
    await this.del(`cache:price:${productId}`, ...chartKeys);
  }

  async invalidateTenantPlan(tenantId: string): Promise<void> {
    await this.del(`cache:plan:${tenantId}`);
  }

  getProductPriceKey(id: string) {
    return `cache:price:${id}`;
  }
  getChartKey(id: string, days: number) {
    return `cache:chart:${id}:${days}`;
  }
  getTenantPlanKey(id: string) {
    return `cache:plan:${id}`;
  }
  getDealsKey() {
    return 'cache:deals:top';
  }

  get ttl() {
    return TTL;
  }
}
