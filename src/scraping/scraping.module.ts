import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SCRAPE_QUEUE } from '../queue/queue.constants';
import { ScrapeProcessor } from './processors/scrape.processor';
import { ScraperService } from './processors/scraper.service';
import { ScraperRegistryService } from './registry/scraper-registry.service';
import { ScrapeSchedulerService } from './scheduler/scrape-scheduler.service';
import { ScraperHealthService } from './health/scraper-health.service';
import { ScraperHealthController } from './health/scraper-health.controller';
import { GamesWorldAdapter } from './adapters/games-world.adapter';
import { SigmaAdapter } from './adapters/sigma.adapter';
import { AlfrensiaAdapter } from './adapters/alfrensia.adapter';
import { ElbadrAdapter } from './adapters/el-badr.adapter';
import { KimoAdapter } from './adapters/kimo.adapter';
import { UaRotationService } from './anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from './anti-bot/domain-rate-limiter.service';

@Module({
  imports: [BullModule.registerQueue({ name: SCRAPE_QUEUE })],
  controllers: [ScraperHealthController],
  providers: [
    ScrapeProcessor,
    ScraperService,
    ScraperRegistryService,
    ScrapeSchedulerService,
    ScraperHealthService,
    SigmaAdapter,
    AlfrensiaAdapter,
    ElbadrAdapter,
    KimoAdapter,
    GamesWorldAdapter,
    UaRotationService,
    DomainRateLimiterService,
  ],
  exports: [ScraperService, ScraperRegistryService],
})
export class ScrapingModule {}
