import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperRegistryService } from '../scraping/registry/scraper-registry.service';
import { ScraperService } from '../scraping/processors/scraper.service';
import { CreateTrackedItemDto } from './dto/create-tracked-item.dto';
import { FREE_TRACKED_ITEMS_LIMIT } from '../plans/plan.constants';
import { ReferralService } from '../referrals/referrals.service';

@Injectable()
export class TrackedItemsService {
  constructor(
    private prisma: PrismaService,
    private registry: ScraperRegistryService,
    private scraperService: ScraperService,
    private referrals: ReferralService,
  ) {}

  async create(dto: CreateTrackedItemDto, userId: string, tenantId: string) {
    const store = this.registry.detectStore(dto.url);

    const [tenant, trackedItemsCount] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          plan: true,
          bonus_tracking_slots: true,
        },
      }),
      this.prisma.trackedItem.count({ where: { tenant_id: tenantId } }),
    ]);

    const trackingLimit =
      tenant.plan === 'PRO' ? Number.POSITIVE_INFINITY : FREE_TRACKED_ITEMS_LIMIT + tenant.bonus_tracking_slots;

    if (trackedItemsCount >= trackingLimit) {
      throw new HttpException(
        {
          error: 'PLAN_LIMIT_REACHED',
          message: `Your current plan allows a maximum of ${trackingLimit} tracked products.`,
          currentCount: trackedItemsCount,
          limit: Number.isFinite(trackingLimit) ? trackingLimit : null,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
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

    await this.referrals.processReferralQualification(userId);

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
