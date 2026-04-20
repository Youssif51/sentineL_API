import { Module } from '@nestjs/common';
import { AlertRulesController } from './alerts.controller';
import { AlertRulesService } from './alerts.service';
import { AlertEngineService } from './alert-engine.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AlertRulesController],
  providers: [AlertRulesService, AlertEngineService],
  exports: [AlertRulesService, AlertEngineService],
})
export class AlertRulesModule {}
