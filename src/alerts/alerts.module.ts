import { Module } from '@nestjs/common';
import { AlertRulesController } from './alerts.controller';
import { AlertRulesService } from './alerts.service';
import { AlertEngineService } from './alert-engine.service';

@Module({
  controllers: [AlertRulesController],
  providers: [AlertRulesService, AlertEngineService],
  exports: [AlertRulesService, AlertEngineService],
})
export class AlertRulesModule {}
