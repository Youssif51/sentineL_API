// src/price-history/price-history.module.ts
import { Module } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertRulesModule } from '../alerts/alerts.module';
import { PriceHistoryController } from './price-history.controller';
@Module({
  imports: [PrismaModule, AlertRulesModule],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService],
  exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
