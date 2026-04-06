import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SCRAPE_QUEUE } from '../../queue/queue.constants';
import { ScrapeJobData } from './scrape-job.interface';
import { ScraperRegistryService } from '../registry/scraper-registry.service';

@Processor(SCRAPE_QUEUE)
export class ScrapeProcessor {
  private readonly logger = new Logger(ScrapeProcessor.name); 

  constructor(private registry: ScraperRegistryService) {}

  @Process({ concurrency: 3 })
  async handle(job: Job<ScrapeJobData>): Promise<void> {
    const { productId, store, url } = job.data;
    this.logger.log(`Processing scrape job — store: ${store}, product: ${productId}`);

    const adapter = this.registry.resolve(url);
    const result = await adapter.scrape(url);

    this.logger.log(`Scraped ${store}: ${result.price} EGP | inStock: ${result.inStock}`);

    // PriceHistoryService.record() is called here in the full project
    // Injected via constructor in the actual src/ implementation
    job.data.productId; // used by price history service
    return Promise.resolve();
  }
}
