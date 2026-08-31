import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@generated/prisma';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException('Authentication required to access this resource');
    }
    if (!user.role) {
      throw new ForbiddenException('User does not have a valid role assignment');
    }
    const hasRequiredRole = requiredRoles.some((role) => {
      if (user.role === role) return true;
      if (user.role === 'ADMIN') return true;
      if (user.role === 'PHARMACY' && role === 'PHARMACY_OWNER') return true;
      if (user.role === 'PHARMACY_OWNER' && role === 'PHARMACY') return true;
      return false;
    });
    if (!hasRequiredRole) {
      throw new ForbiddenException(`Insufficient permissions. Required role(s): ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
