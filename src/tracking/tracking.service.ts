import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperRegistryService } from '../scraping/registry/scraper-registry.service';
import { ScraperService } from '../scraping/processors/scraper.service';
import { CreateTrackedItemDto } from './dto/create-tracked-item.dto';
const FREE_LIMIT = 5;

@Injectable()
export class TrackedItemsService {
  constructor(
    private prisma: PrismaService,
    private registry: ScraperRegistryService,
    private scraperService: ScraperService,
  ) {}

  async create(dto: CreateTrackedItemDto, userId: string, tenantId: string) {
    const store = this.registry.detectStore(dto.url);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    if (tenant.plan === 'FREE') {
      const count = await this.prisma.trackedItem.count({ where: { tenant_id: tenantId } });
      if (count >= FREE_LIMIT) {
        throw new HttpException(
          {
            error: 'PLAN_LIMIT_REACHED',
            message: `Free plan allows a maximum of ${FREE_LIMIT} tracked products.`,
            upgradeUrl: '/billing/checkout',
            currentCount: count,
            limit: FREE_LIMIT,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const product = await this.prisma.product.upsert({
      where: { url: dto.url },
      update: {},
      create: { url: dto.url, store, title: dto.url },
    });

    const trackedItem = await this.prisma.trackedItem.create({
      data: { user_id: userId, product_id: product.id, tenant_id: tenantId },
      include: { product: true },
    });

    await this.scraperService.enqueueImmediate({
      productId: product.id,
      tenantId,
      store,
      url: dto.url,
      priority: tenant.plan === 'PRO' ? 1 : 2,
    });

    return trackedItem;
  }

  async findAll(tenantId: string) {
    return this.prisma.trackedItem.findMany({
      where: { tenant_id: tenantId },
      include: {
        product: {
          include: {
            price_history: { orderBy: { scraped_at: 'desc' }, take: 2 },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const item = await this.prisma.trackedItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Tracked item not found');
    await this.prisma.trackedItem.delete({ where: { id } });
  }
}
