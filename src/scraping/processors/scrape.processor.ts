import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCRAPE_QUEUE } from '../../queue/queue.constants';
import { ScrapeJobData } from './scrape-job.interface';
import { ScraperRegistryService } from '../registry/scraper-registry.service';

@Processor(SCRAPE_QUEUE, { concurrency: 3 })
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  // 1. شيلنا الـ RateLimiter من هنا، الكلاس ده رجع خفيف تاني
  constructor(private registry: ScraperRegistryService) {
    super();
  }

  async process(job: Job<ScrapeJobData>): Promise<void> {
    const { productId, store, url } = job.data;
    this.logger.log(`Processing scrape job — store: ${store}, product: ${productId}`);

    const adapter = this.registry.resolve(url);

    // 2. السحر هنا! بننادي الدالة المحمية، وهي هتعمل كل الشغل الشاق من جواها
    const result = await adapter.scrapeWithProtection(url);

    this.logger.log(`Scraped ${store}: ${result.price} EGP | inStock: ${result.inStock}`);

    // PriceHistoryService.record() will go here later
    job.data.productId;
  }
}
