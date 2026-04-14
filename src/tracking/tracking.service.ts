import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperRegistryService } from '../scraping/registry/scraper-registry.service';
import { ScraperService } from '../scraping/processors/scraper.service';
import { CreateTrackedItemDto } from './dto/create-tracked-item.dto';
import { CacheService } from '../cache/cache.service'; // 👈 1. استيراد الكاش

const FREE_LIMIT = 5;

// عشان نعّرف الـ TypeScript بشكل الداتا اللي هتتخزن في الكاش
interface CachedPlanInfo {
  plan: string;
  count: number;
}

@Injectable()
export class TrackedItemsService {
  constructor(
    private prisma: PrismaService,
    private registry: ScraperRegistryService,
    private scraperService: ScraperService,
    private cache: CacheService, // 👈 2. حقن الكاش
  ) {}

  async create(dto: CreateTrackedItemDto, userId: string, tenantId: string) {
    const store = this.registry.detectStore(dto.url);

    const planKey = this.cache.getTenantPlanKey(tenantId);

    // 3. اسأل التلاجة الأول
    let tenantInfo = await this.cache.get<CachedPlanInfo>(planKey);

    // 4. لو التلاجة فاضية (Cache Miss)
    if (!tenantInfo) {
      // نروح الداتابيز (المخزن)
      const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      const count = await this.prisma.trackedItem.count({ where: { tenant_id: tenantId } });

      tenantInfo = { plan: tenant.plan, count: count };

      // ونحط الداتا في التلاجة لمدة دقيقة (حسب الـ TTL اللي إنت ظابطه)
      await this.cache.set(planKey, tenantInfo, this.cache.ttl.TENANT_PLAN);
    }

    // 5. فحص الليمت بناءً على الداتا السريعة
    if (tenantInfo.plan === 'FREE' && tenantInfo.count >= FREE_LIMIT) {
      throw new HttpException(
        {
          error: 'PLAN_LIMIT_REACHED',
          message: `Free plan allows a maximum of ${FREE_LIMIT} tracked products.`,
          upgradeUrl: '/billing/checkout',
          currentCount: tenantInfo.count,
          limit: FREE_LIMIT,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    // ==========================================

    // ... باقي كود إنشاء المنتج وعمل Upsert زي ما هو في الكود الأصلي بتاعك
    const product = await this.prisma.product.upsert({
      where: { url: dto.url },
      update: {},
      create: { url: dto.url, store, title: dto.url },
    });

    // مهم جداً: بعد ما عملنا Create لـ Item جديد، لازم نمسح كاش اليوزر
    // عشان الريكويست اللي جاي العدد (count) يتحدث وميبقاش قاري داتا قديمة!
    await this.cache.invalidateTenantPlan(tenantId); // 👈 6. تدمير الكاش القديم

    const trackedItem = await this.prisma.trackedItem.create({
      data: { user_id: userId, product_id: product.id, tenant_id: tenantId },
      include: { product: true },
    });

    await this.scraperService.enqueueImmediate({
      productId: product.id,
      tenantId,
      store,
      url: dto.url,
      priority: tenantInfo.plan === 'PRO' ? 1 : 2, // استخدمنا الخطة من الكاش
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
