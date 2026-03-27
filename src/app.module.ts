import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';
//import { RedisModule } from '../04-setup-redis-connection/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().default(6379),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        SMTP_HOST: Joi.string().required(),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        SMTP_FROM: Joi.string().required(),
        PAYMOB_API_KEY: Joi.string().required(),
        PAYMOB_INTEGRATION_ID: Joi.number().required(),
        PAYMOB_IFRAME_ID: Joi.number().required(),
        PAYMOB_HMAC_SECRET: Joi.string().required(),
        FRONTEND_URL: Joi.string().default('http://localhost:3001'),
      }),
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
        },
        defaultJobOptions: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
    }),
    HealthModule,
    //RedisModule,
  ],
})
export class AppModule {}
