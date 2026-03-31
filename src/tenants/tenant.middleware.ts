import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { tenantStorage, TenantStore } from './tenant.context';
import { JwtPayload } from '../auth/strategies/jwt-payload.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private jwt: JwtService) {}

  use(req: Request & { tenantId?: string; userId?: string }, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization; // console.log(authHeader) => Bearer <token>
    if (!authHeader?.startsWith('Bearer ')) return next();

    try {
      const token = authHeader.split(' ')[1];
      const payload = this.jwt.decode(token) as JwtPayload;
      if (!payload?.tenantId) return next();

      req.tenantId = payload.tenantId;
      req.userId = payload.sub;

      const store: TenantStore = { tenantId: payload.tenantId, userId: payload.sub };
      tenantStorage.run(store, () => next());
    } catch {
      next();
    }
  }
}
