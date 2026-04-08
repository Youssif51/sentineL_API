import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperService } from '../processors/scraper.service';
import { SCRAPE_INTERVAL_MINUTES } from './plan.constants';

@Injectable()
export class ScrapeSchedulerService {
  private readonly logger = new Logger(ScrapeSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private scraperService: ScraperService,
  ) {}

  @Cron('0 * * * *')
  async scheduleDueProducts(): Promise<void> {
    this.logger.log('Checking for products due for scraping...');
    const now = new Date();

    const proThreshold  = new Date(now.getTime() - SCRAPE_INTERVAL_MINUTES.PRO  * 60_000);
    const freeThreshold = new Date(now.getTime() - SCRAPE_INTERVAL_MINUTES.FREE * 60_000);

    // Query distinct products (not TrackedItems) to avoid duplicate jobs
    // PRO tenant on the product → gets priority 1, otherwise priority 2
    const dueProducts = await this.prisma.product.findMany({
      where: {
        tracked_items: { some: {} },
        OR: [
          { last_scraped_at: null },
          {
            last_scraped_at: { lt: proThreshold },
            tracked_items: { some: { tenant: { plan: 'PRO' } } },
          },
          {
            last_scraped_at: { lt: freeThreshold },
            tracked_items: { some: { tenant: { plan: 'FREE' } } },
          },
        ],
      },
      include: {
        tracked_items: { include: { tenant: true } },
      },
    });

    this.logger.log(`Enqueueing ${dueProducts.length} products`);

    await Promise.all(
      dueProducts.map((product) => {
        const hasPro = product.tracked_items.some((item) => item.tenant.plan === 'PRO');
        return this.scraperService.enqueueProduct({
          productId: product.id,
          tenantId: product.tracked_items[0].tenant_id,
          store: product.store,
          url: product.url,
          priority: hasPro ? 1 : 2,
        });
      }),
    );
  }
}
