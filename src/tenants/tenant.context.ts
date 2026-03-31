import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string;
  userId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();
