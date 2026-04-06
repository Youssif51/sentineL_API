import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SCRAPE_QUEUE } from '../../queue/queue.constants';
import { ScrapeProcessor } from './scrape.processor';
import { ScraperService } from './scraper.service';
import { ScraperRegistryService } from '../registry/scraper-registry.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
  ],
  providers: [ScrapeProcessor, ScraperService, ScraperRegistryService],
  exports: [ScraperService],
})
export class ScraperModule {}