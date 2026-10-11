import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { buildAuthorizationContext } from '../shared/authorization';
import { EvidenceService } from '../domain/evidence-service';
import { EvidenceRepository } from '../infrastructure/repositories/evidence-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { DomainError } from '@e-saathi/core';

const evidenceRepo = new EvidenceRepository();
const deviceRepo = new DeviceRepository();
const evidenceService = new EvidenceService(evidenceRepo, deviceRepo);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const ctx = await buildAuthorizationContext(event as unknown as ApiGatewayJwtEvent);
    const { routeKey, pathParameters, body } = event;

    if (routeKey === 'POST /evidence/upload-intent') {
      const input = JSON.parse(body || '{}');
      const response = await evidenceService.generateUploadIntent(ctx, input);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'POST /evidence/{evidenceId}/complete') {
      const evidenceId = pathParameters?.evidenceId;
      if (!evidenceId) return { statusCode: 400, body: 'Missing evidenceId' };
      const response = await evidenceService.completeUpload(ctx, evidenceId);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'GET /evidence/{evidenceId}') {
      const evidenceId = pathParameters?.evidenceId;
      if (!evidenceId) return { statusCode: 400, body: 'Missing evidenceId' };
      const response = await evidenceService.getEvidenceMetadata(ctx, evidenceId);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'GET /evidence/{evidenceId}/access') {
      const evidenceId = pathParameters?.evidenceId;
      if (!evidenceId) return { statusCode: 400, body: 'Missing evidenceId' };
      const response = await evidenceService.generateAccessUrl(ctx, evidenceId);
      return { statusCode: 200, body: JSON.stringify({ url: response, accessUrl: response }) };
    }

    if (routeKey === 'POST /evidence/{evidenceId}/verify') {
      const evidenceId = pathParameters?.evidenceId;
      if (!evidenceId) return { statusCode: 400, body: 'Missing evidenceId' };
      const response = await evidenceService.verifyEvidence(ctx, evidenceId);
      return { statusCode: 200, body: JSON.stringify(response) };
    }

    if (routeKey === 'GET /devices/{deviceId}/evidence') {
      const deviceId = pathParameters?.deviceId;
      if (!deviceId) return { statusCode: 400, body: 'Missing deviceId' };
      const response = await evidenceService.listEvidenceForDevice(ctx, deviceId);
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
