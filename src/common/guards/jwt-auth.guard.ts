import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // the method of the request (controller or method)
      context.getClass(), // choose the class of the request (controller)
    ]);
    if (isPublic) return true; // if the request is public, return true and skip the guard
    return super.canActivate(context); // if the request is not public, check if the user is authenticated from the jwt strategy (jwt.strategy.ts)
  }

  handleRequest(err: any, user: any, info: { name?: string }) {
    if (err || !user) {
      const message = info?.name === 'TokenExpiredError'
        ? 'Access token has expired'
        : 'Unauthorized — valid token required';
      throw (err as Error) || new UnauthorizedException(message);
    }
    return user;
  }
}
