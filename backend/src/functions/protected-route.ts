import { logger } from '../shared/logger';
import { buildAuthorizationContext, requirePermission } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { DomainError } from '@e-saathi/core';

export const handler = async (event: ApiGatewayJwtEvent) => {
  try {
    const ctx = await buildAuthorizationContext(event);

    // Example: Require device:read permission
    requirePermission(ctx, 'device:read');

    logger.info('Protected route accessed successfully', { actorId: ctx.actorId });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Access granted',
        actorId: ctx.actorId,
        role: ctx.role,
        organizationId: ctx.organizationId,
      }),
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return {
        statusCode: error.code === 'UNAUTHORIZED' ? 401 : 403,
        body: JSON.stringify({ error: error.message, code: error.code }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
