import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from './redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onModuleInit() {
    try {
      const response = await this.redisClient.ping();
      console.log(`🔵 Redis Says: ${response}`);
    } catch (error) {
      console.error('🔴 Redis connection failed:', error);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
