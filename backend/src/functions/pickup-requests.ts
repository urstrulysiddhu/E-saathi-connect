import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { buildAuthorizationContext } from '../shared/authorization';
import { PickupRequestService } from '../domain/pickup-request-service';
import { PickupRequestRepository } from '../infrastructure/repositories/pickup-request-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { DomainError } from '@e-saathi/core';

const requestRepo = new PickupRequestRepository();
const deviceRepo = new DeviceRepository();
const service = new PickupRequestService(requestRepo, deviceRepo);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const ctx = await buildAuthorizationContext(event as unknown as ApiGatewayJwtEvent);
    const { routeKey, pathParameters, body } = event;

    if (routeKey === 'POST /requests') {
      const input = JSON.parse(body || '{}');
      const response = await service.createRequest(ctx, input);
      return { statusCode: 201, body: JSON.stringify(response) };
    }

    if (routeKey === 'GET /requests') {
      const startTime = Date.now();
      if (ctx.role === 'CONSUMER') {
        const response = await service.listConsumerRequests(ctx);
        console.log(`[GET /requests] Consumer request completed in ${Date.now() - startTime}ms`);
        return { statusCode: 200, body: JSON.stringify({ items: response }) };
      } else if (ctx.role === 'COLLECTOR') {
        const response = await service.getCollectorRequests(ctx);
        console.log(`[GET /requests] Collector request completed in ${Date.now() - startTime}ms, items: ${response.items?.length || 0}`);
        return { statusCode: 200, body: JSON.stringify(response) };
      }
      return { statusCode: 403, body: 'Forbidden' };
    }

    if (routeKey === 'POST /requests/{requestId}/accept') {
      const requestId = pathParameters?.requestId;
      if (!requestId) return { statusCode: 400, body: 'Missing requestId' };
      const response = await service.acceptRequest(ctx, requestId);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'POST /requests/{requestId}/reject') {
      const requestId = pathParameters?.requestId;
      if (!requestId) return { statusCode: 400, body: 'Missing requestId' };
      const input = JSON.parse(body || '{}');
      const response = await service.rejectRequest(ctx, requestId, input);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'POST /requests/{requestId}/escalate') {
      const requestId = pathParameters?.requestId;
      if (!requestId) return { statusCode: 400, body: 'Missing requestId' };
      const response = await service.escalateRequest(ctx, requestId);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    return { statusCode: 404, body: 'Not found' };
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      const codeMap: Record<string, number> = {
        VALIDATION_ERROR: 422,
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        CONFLICT: 409,
      };
      return {
        statusCode: codeMap[error.code] || 500,
        body: JSON.stringify({ error: error.message, code: error.code }),
      };
    }
    console.error('Unhandled error', error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
