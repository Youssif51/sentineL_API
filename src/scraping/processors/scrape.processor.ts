import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCRAPE_QUEUE } from '../../queue/queue.constants';
import { ScrapeJobData } from './scrape-job.interface';
import { ScraperRegistryService } from '../registry/scraper-registry.service';
import { PriceHistoryService } from '../../price-history/price-history.service';
@Processor(SCRAPE_QUEUE, { concurrency: 3 })
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private registry: ScraperRegistryService,
    private priceHistory: PriceHistoryService,
  ) {
    super();
  }

  async process(job: Job<ScrapeJobData>): Promise<void> {
    const { productId, store, url } = job.data;
    this.logger.log(`Processing scrape job - store: ${store}, product: ${productId}`);

    const adapter = this.registry.resolve(url);

    const result = await adapter.scrapeWithProtection(url);

    this.logger.log(`Scraped ${store}: ${result.price} EGP | inStock: ${result.inStock}`);

    await this.priceHistory.record(productId, result);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScrapeJobData>, error: Error) {
    this.logger.error(
      `Scrape job ${job?.id ?? 'unknown'} failed for ${job?.data?.url ?? 'unknown url'}: ${error.message}`,
    );
  }
}
