import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateAlertRuleDto } from '././dto/update-alert-rule.dto';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { PrismaService } from '.././prisma/prisma.service';

@Injectable()
export class AlertRulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAlertRuleDto, tenantId: string) {
    await this.assertTrackedItemOwnership(dto.tracked_item_id, tenantId);
    return this.prisma.alertRule.create({
      data: { tracked_item_id: dto.tracked_item_id, type: dto.type, threshold: dto.threshold },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.alertRule.findMany({
      where: { tracked_item: { tenant_id: tenantId } },
      include: { tracked_item: { include: { product: true } } },
    });
  }

  async update(id: string, dto: UpdateAlertRuleDto, tenantId: string) {
    await this.assertRuleOwnership(id, tenantId);
    return this.prisma.alertRule.update({
      where: { id },
      data: {
        ...(dto.threshold !== undefined && { threshold: dto.threshold }),
        last_fired_at: null,
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.assertRuleOwnership(id, tenantId);
    await this.prisma.alertRule.delete({ where: { id } });
  }

  private async assertTrackedItemOwnership(trackedItemId: string, tenantId: string) {
    const item = await this.prisma.trackedItem.findFirst({
      where: { id: trackedItemId, tenant_id: tenantId },
    });
    if (!item) throw new NotFoundException('Tracked item not found');
  }

  private async assertRuleOwnership(ruleId: string, tenantId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, tracked_item: { tenant_id: tenantId } },
    });
    if (!rule) throw new NotFoundException('Alert rule not found');
  }
}
