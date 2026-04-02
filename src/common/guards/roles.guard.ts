import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../auth/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // the method of the request (controller or method) like getUsers, getUser, etc.
      context.getClass(), // the class of the request (controller) like UsersController, UserController, etc.
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as User;
    if (!required.includes(user.role as Role)) {

        throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
