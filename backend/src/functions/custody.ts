import { CustodyService } from '../domain/custody-service';
import { CustodyRepository } from '../infrastructure/repositories/custody-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { buildAuthorizationContext } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { DomainError } from '@e-saathi/core';

const custodyRepo = new CustodyRepository();
const deviceRepo = new DeviceRepository();
const commercialRepo = new CommercialRepository();
const service = new CustodyService(custodyRepo, deviceRepo, commercialRepo);

export const handler = async (
  event: ApiGatewayJwtEvent & {
    httpMethod: string;
    path: string;
    pathParameters: Record<string, string | undefined> | null;
    body: string | null;
  }
) => {
  try {
    const ctx = await buildAuthorizationContext(event);

    const method =
      event.httpMethod ||
      (event as unknown as { requestContext?: { http?: { method?: string } } }).requestContext?.http
        ?.method;
    const path =
      event.path ||
      (event as unknown as { requestContext?: { http?: { path?: string } } }).requestContext?.http
        ?.path ||
      '';
    const pathParams = event.pathParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const deviceId = pathParams.deviceId;

    if (!deviceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing deviceId parameter' }) };
    }

    if (method === 'POST' && path.endsWith('/transition')) {
      const result = await service.transitionCustody(ctx, deviceId, body);
      return { statusCode: 201, body: JSON.stringify(result) };
    }

    if (method === 'GET' && path.endsWith('/custody/latest')) {
      const event = await service.getLatestEvent(ctx, deviceId);
      return { statusCode: 200, body: JSON.stringify(event || {}) };
    }

    if (method === 'GET' && path.endsWith('/custody')) {
      const events = await service.getDeviceTimeline(ctx, deviceId);
      return { statusCode: 200, body: JSON.stringify(events) };
    }

    if (method === 'GET' && path.endsWith('/custody/verify')) {
      const verification = await service.verifyDeviceCustodyChain(ctx, deviceId);
      return { statusCode: 200, body: JSON.stringify(verification) };
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
