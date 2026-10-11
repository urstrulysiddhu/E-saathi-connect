import { DeviceService } from '../domain/device-service';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { buildAuthorizationContext } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { DomainError } from '@e-saathi/core';

const repository = new DeviceRepository();
const service = new DeviceService(repository);

export const handler = async (
  event: ApiGatewayJwtEvent & {
    httpMethod?: string;
    path?: string;
    pathParameters?: Record<string, string | undefined> | null;
    body?: string | null;
    queryStringParameters?: Record<string, string | undefined> | null;
  }
) => {
  const requestId =
    (event as any).requestContext?.requestId || 'unknown-request-id';

  let method = 'UNKNOWN';
  let routePath = event.path || 'UNKNOWN';

  try {
    const ctx = await buildAuthorizationContext(event);

    method =
      event.httpMethod ||
      (event as unknown as { requestContext?: { http?: { method?: string } } }).requestContext?.http
        ?.method || 'UNKNOWN';
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Parsed parameters',
      requestId,
      method,
      path: routePath,
      hasBody: !!event.body,
      queryParams,
      pathParams
    }));

    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        if (method !== 'GET') {
          console.error(JSON.stringify({ level: 'ERROR', message: 'Failed to parse request body', requestId, error: String(parseError) }));
          return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }
        // For GET requests, ignore body parsing errors (API Gateway might pass empty string for Content-Type: application/json)
      }
    }

    if (method === 'POST') {
      const device = await service.createDevice(ctx, body as any);
      return { statusCode: 201, body: JSON.stringify(device) };
    }

    if (method === 'GET' && pathParams.deviceId) {
      const device = await service.getDevice(ctx, pathParams.deviceId);
      return { statusCode: 200, body: JSON.stringify(device) };
    }

    if (method === 'GET') {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Before parsing limit',
        requestId,
        rawLimit: queryParams.limit
      }));
      const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 20;
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Before service.listDevices',
        requestId,
        limit,
        nextToken: queryParams.nextToken,
        actorId: ctx.actorId,
        role: ctx.role
      }));
      
      const result = await service.listDevices(ctx, { limit, nextToken: queryParams.nextToken });
      
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'After service.listDevices',
        requestId,
        itemCount: result.items.length
      }));
      
      const response = { statusCode: 200, body: JSON.stringify(result) };
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Response created',
        requestId,
        statusCode: response.statusCode
      }));
      return response;
    }

    if (method === 'PATCH' && pathParams.deviceId) {
      const expectedVersion = (body as any).version;
      if (typeof expectedVersion !== 'number') {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing or invalid version field' }),
        };
      }
      const device = await service.updateDevice(ctx, pathParams.deviceId, expectedVersion, body);
      return { statusCode: 200, body: JSON.stringify(device) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error) {
    if (error instanceof DomainError) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        VALIDATION_ERROR: 422,
      };
      return {
        statusCode: statusMap[error.code] || 400,
        body: JSON.stringify({ error: error.message, code: error.code }),
      };
    }
    
    // Log unexpected exceptions thoroughly
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Unhandled exception in Lambda handler',
      requestId,
      method,
      path: routePath,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
