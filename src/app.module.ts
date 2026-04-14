import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/throttler-exception.filter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SecurityModule } from './security/security.module';
import { ScrapingModule } from './scraping/scraping.module';
import { PriceHistoryModule } from './price-history/price-history.module';
import { CacheModule } from './cache/cache.module';
import { AlertRulesModule } from './alerts/alerts.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        // DATABASE_URL: Joi.string().required(),
        // REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().default(6379),
        //JWT_ACCESS_SECRET: Joi.string().required(),
        //JWT_REFRESH_SECRET: Joi.string().required(),
        //SMTP_HOST: Joi.string().required(),
        //SMTP_USER: Joi.string().required(),
        //SMTP_PASS: Joi.string().required(),
        //SMTP_FROM: Joi.string().required(),
        //PAYMOB_API_KEY: Joi.string().required(),
        //PAYMOB_INTEGRATION_ID: Joi.number().required(),
        //PAYMOB_IFRAME_ID: Joi.number().required(),
        //PAYMOB_HMAC_SECRET: Joi.string().required(),
        //FRONTEND_URL: Joi.string().default('http://localhost:3001'),
      }),
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          password: process.env.REDIS_PASSWORD ?? 'password',
        },
        defaultJobOptions: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: 60000, // 1 minute window
            limit: 100, // 100 requests per user
          },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.get('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
        }),
      }),
    }),
    PrismaModule,
    HealthModule,
    RedisModule,
    AuthModule,
    SecurityModule,
    ScrapingModule,
    PriceHistoryModule,
    CacheModule,
    AlertRulesModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
