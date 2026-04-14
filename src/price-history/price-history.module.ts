// src/price-history/price-history.module.ts
import { Module } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertRulesModule } from '../alerts/alerts.module';
@Module({
  imports: [PrismaModule, AlertRulesModule],
  providers: [PriceHistoryService],
  exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
