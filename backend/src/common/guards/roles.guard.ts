import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AuthUser } from '../decorators/current-user.decorator.js';
import type { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    if (!request.user) {
      throw new ForbiddenException('Role-protected route requires authentication');
    }

    const hasRole = requiredRoles.includes(request.user.role);
    if (!hasRole) {
      throw new ForbiddenException(`Requires role: ${requiredRoles.join(' or ')}`);
    }
    return true;
  }
}