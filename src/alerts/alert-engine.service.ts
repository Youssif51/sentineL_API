import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { AlertRule, AlertType, Product, TrackedItem, User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
type RuleWithRelations = AlertRule & {
  tracked_item: TrackedItem & { user: User; product: Product };
};

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
  ) {}

  async check(productId: string, oldPrice: number | null, newPrice: number): Promise<void> {
    if (oldPrice === null) return;

    const rules = await this.prisma.alertRule.findMany({
      where: { tracked_item: { product_id: productId } },
      include: { tracked_item: { include: { user: true, product: true } } },
    });

    await Promise.allSettled(
      rules.map((rule) => this.evaluate(rule as RuleWithRelations, oldPrice, newPrice)),
    );
  }

  private async evaluate(
    rule: RuleWithRelations,
    oldPrice: number,
    newPrice: number,
  ): Promise<void> {
    const fires = this.shouldFire(rule, oldPrice, newPrice);

    if (!fires) {
      if (rule.last_fired_at && this.hasPriceRecovered(rule, newPrice)) {
        await this.prisma.alertRule.update({
          where: { id: rule.id },
          data: { last_fired_at: null },
        });
      }
      return;
    }

    if (rule.last_fired_at) return; // already fired, waiting for recovery

    await this.fire(rule, oldPrice, newPrice);
  }

  private shouldFire(rule: AlertRule, oldPrice: number, newPrice: number): boolean {
    const threshold = Number(rule.threshold);
    if (rule.type === AlertType.PERCENTAGE_DROP) {
      const dropPct = ((oldPrice - newPrice) / oldPrice) * 100;
      return dropPct >= threshold;
    }
    if (rule.type === AlertType.TARGET_PRICE) {
      return newPrice <= threshold;
    }
    return false;
  }

  private hasPriceRecovered(rule: AlertRule, currentPrice: number): boolean {
    if (rule.type === AlertType.TARGET_PRICE) {
      return currentPrice > Number(rule.threshold);
    }

    if (rule.type === AlertType.PERCENTAGE_DROP) {
      if (!rule.last_fired_price) return true;

      // شرط التعافي: السعر لازم يرفع بنسبة 5% عن السعر اللي بعتنا عنده آخر مرة
      const recoveryThreshold = rule.last_fired_price * 1.05;
      return currentPrice >= recoveryThreshold;
    }

    return false;
  }

  private async fire(rule: RuleWithRelations, oldPrice: number, newPrice: number): Promise<void> {
    const dropPct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { last_fired_at: new Date(), last_fired_price: newPrice },
    });
    await this.prisma.alertLog.create({
      data: { alert_rule_id: rule.id, old_price: oldPrice, new_price: newPrice },
    });

    await this.mailQueue.add(
      'send-price-alert',
      {
        to: rule.tracked_item.user.email,
        productTitle: rule.tracked_item.product.title,
        oldPrice,
        newPrice,
        dropPercent: dropPct,
        store: rule.tracked_item.product.store,
        productUrl: rule.tracked_item.product.url,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    );

    this.logger.log(
      `Alert fired: "${rule.tracked_item.product.title}" — ${oldPrice} → ${newPrice} EGP (-${dropPct}%)`,
    );
  }
}
