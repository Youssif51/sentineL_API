import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapedProduct } from '../scraping/adapters/scraper-adapter.interface';
import { AlertEngineService } from '../alerts/alert-engine.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class PriceHistoryService {
  private readonly logger = new Logger(PriceHistoryService.name);

  constructor(
    private prisma: PrismaService,
    private alertEngine: AlertEngineService,
    private cache: CacheService,
  ) {}

  async record(productId: string, scraped: ScrapedProduct): Promise<void> {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });

    const lastPrice = product.last_price ? Number(product.last_price) : null;
    const priceChanged = lastPrice === null || Math.abs(lastPrice - scraped.price) > 0.01;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        title: scraped.title,
        in_stock: scraped.inStock,
        last_price: scraped.price,
        last_scraped_at: scraped.scrapedAt,
      },
    });

    if (priceChanged) {
      await this.prisma.priceHistory.create({
        data: {
          product_id: productId,
          price: scraped.price,
          currency: scraped.currency,
          in_stock: scraped.inStock,
          scraped_at: scraped.scrapedAt,
        },
      });

      this.logger.log(`Price change for ${productId}: ${lastPrice} → ${scraped.price} EGP`);

      // Invalidate cache on price change
      await this.cache.invalidateProductPrice(productId);

      // Trigger alert engine only on price change
      await this.alertEngine.check(productId, lastPrice, scraped.price);
    } else {
      this.logger.debug(`No price change for ${productId} (${scraped.price} EGP)`);
    }
  }

  async getChartData(productId: string, days = 30) {
    const cached = await this.cache.get<unknown[]>(this.cache.getChartKey(productId, days));
    if (cached) return cached;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const data = await this.prisma.priceHistory.findMany({
      where: { product_id: productId, scraped_at: { gte: since } },
      orderBy: { scraped_at: 'asc' },
      select: { price: true, scraped_at: true, in_stock: true },
    });

    await this.cache.set(this.cache.getChartKey(productId, days), data, this.cache.ttl.CHART_DATA);
    return data;
  }

  async getTrackedItemChartData(trackedItemId: string, tenantId: string, days = 30) {
    const trackedItem = await this.prisma.trackedItem.findFirst({
      where: { id: trackedItemId, tenant_id: tenantId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            store: true,
            url: true,
            last_price: true,
            in_stock: true,
            last_scraped_at: true,
          },
        },
      },
    });

    if (!trackedItem) {
      throw new NotFoundException('Tracked item not found');
    }

    const chart = await this.getChartData(trackedItem.product_id, days);

    return {
      trackedItemId: trackedItem.id,
      product: trackedItem.product,
      rangeDays: days,
      points: chart,
    };
  }
}
