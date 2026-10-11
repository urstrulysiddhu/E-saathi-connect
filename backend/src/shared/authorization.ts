import { AuthorizationContext, extractSubject, ApiGatewayJwtEvent } from '../domain/identity';
import { DomainError, RolePermissions, Permission } from '@e-saathi/core';
import { logger } from './logger';

export const buildAuthorizationContext = async (
  event: ApiGatewayJwtEvent
): Promise<AuthorizationContext> => {
  try {
    const subject = extractSubject(event);

    // In a full implementation, this queries DynamoDB to resolve the actor.
    // For Phase 2 foundation, we mock the resolution based on test claims.
    const claims = event.requestContext.authorizer.jwt.claims;

    // Example test hook: if the token passes a custom "custom:role" claim, we use it for testing
    // In production, this data MUST be derived from the database, not the client token.
    const rawRole = ((claims['custom:role'] as string) || 'CONSUMER').trim().toUpperCase();
    let roleStr = rawRole as import('@e-saathi/core').ActorRole;
    
    // Validate role exists in RolePermissions
    if (!RolePermissions[roleStr as keyof typeof RolePermissions]) {
      roleStr = 'CONSUMER';
    }

    const orgId = claims['custom:org'] as string | undefined;
    const isSuspended = claims['custom:suspended'] === 'true';

    const ctx: AuthorizationContext = {
      subject,
      userId: `user_${subject}`,
      actorId: `actor_${subject}`,
      organizationId: orgId,
      role: roleStr,
      permissions: RolePermissions[roleStr as keyof typeof RolePermissions] || [],
      actorStatus: isSuspended ? 'SUSPENDED' : 'ACTIVE',
      membershipStatus: orgId ? 'ACTIVE' : undefined,
      requestId: event.requestContext.requestId,
    };

    logger.info('Authorization context built', { actorId: ctx.actorId, role: ctx.role });
    return ctx;
  } catch (error) {
    logger.error('Failed to build authorization context', error);
    throw new DomainError('Unauthorized', 'UNAUTHORIZED');
  }
};

export const requirePermission = (ctx: AuthorizationContext, permission: Permission): void => {
  if (ctx.actorStatus !== 'ACTIVE') {
    throw new DomainError(`Actor is ${ctx.actorStatus}`, 'FORBIDDEN');
  }
  if (!ctx.permissions.includes(permission)) {
    logger.warn('Permission denied', {
      actorId: ctx.actorId,
      requested: permission,
      role: ctx.role,
    });
    throw new DomainError('Missing required permission', 'FORBIDDEN');
  }
};

export const requireOrganization = (ctx: AuthorizationContext, organizationId: string): void => {
  if (ctx.organizationId !== organizationId) {
    logger.warn('Cross-organization access denied', {
      actorId: ctx.actorId,
      orgId: ctx.organizationId,
      targetOrgId: organizationId,
    });
    throw new DomainError('Cross-organization access forbidden', 'FORBIDDEN');
  }
};
