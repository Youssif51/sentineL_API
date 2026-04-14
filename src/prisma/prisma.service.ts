import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantStorage } from '../tenants/tenant.context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('db connected sucssfuly');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  get currentTenantId(): string | undefined {
    return tenantStorage.getStore()?.tenantId;
  }

  tenantWhere<T extends object>(extra: T = {} as T): T & { tenant_id: string } {
    const tenantId = this.currentTenantId;
    if (!tenantId) throw new Error('No tenant context in current scope');
    return { ...extra, tenant_id: tenantId };
  }
}
