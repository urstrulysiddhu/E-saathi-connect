import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { buildAuthorizationContext } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { RoutingService } from '../domain/routing-service';
import { DestinationRepository } from '../infrastructure/repositories/destination-repository';
import { NetworkRepository } from '../infrastructure/repositories/network-repository';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { RoutingRepository } from '../infrastructure/repositories/routing-repository';
import { RoutingEligibilityService } from '../domain/routing-eligibility-service';
import { DomainError } from '@e-saathi/core';

const destRepo = new DestinationRepository();
const networkRepo = new NetworkRepository();
const commRepo = new CommercialRepository();
const deviceRepo = new DeviceRepository();
const eligService = new RoutingEligibilityService();
const routingService = new RoutingService(
  null as unknown as RoutingRepository,
  destRepo,
  networkRepo,
  commRepo,
  deviceRepo,
  eligService
);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const ctx = await buildAuthorizationContext(event as unknown as ApiGatewayJwtEvent);
    const { routeKey, pathParameters, body } = event;

    if (routeKey === 'POST /destinations') {
      const input = JSON.parse(body || '{}');
      const result = await routingService.createDestination(ctx, input);
      return { statusCode: 201, body: JSON.stringify(result) };
    }

    if (routeKey === 'GET /destinations/{destinationId}') {
      const destinationId = pathParameters?.destinationId;
      if (!destinationId) throw new DomainError('Missing destinationId', 'VALIDATION_ERROR');
      const result = await routingService.getDestination(ctx, destinationId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) };
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      const statusCode =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'FORBIDDEN'
            ? 403
            : error.code === 'CONFLICT'
              ? 409
              : 400;
      return { statusCode, body: JSON.stringify({ message: error.message, code: error.code }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
};
