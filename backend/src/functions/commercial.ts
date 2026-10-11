import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { buildAuthorizationContext } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';
import { CommercialService } from '../domain/commercial-service';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { DomainError } from '@e-saathi/core';

const commRepo = new CommercialRepository();
const commercialService = new CommercialService(commRepo);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const ctx = await buildAuthorizationContext(event as unknown as ApiGatewayJwtEvent);
    const { routeKey, pathParameters, body } = event;

    if (routeKey === 'POST /offers') {
      const input = JSON.parse(body || '{}');
      const result = await commercialService.createOffer(ctx, input);
      return { statusCode: 201, body: JSON.stringify(result) };
    }

    if (routeKey === 'GET /commercial/transactions') {
      const result = await commercialService.listTransactions(ctx);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    if (routeKey === 'POST /commercial/transactions') {
      const input = JSON.parse(body || '{}');
      const result = await commercialService.proposeTransaction(ctx, input);
      return { statusCode: 201, body: JSON.stringify(result) };
    }

    if (routeKey === 'POST /commercial/transactions/{transactionId}/accept') {
      const txId = pathParameters?.transactionId;
      if (!txId) throw new DomainError('Missing transactionId', 'VALIDATION_ERROR');
      const input = JSON.parse(body || '{}');
      const result = await commercialService.acceptTransaction(ctx, txId, input.version, input.agreedAmount);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    if (routeKey === 'POST /commercial/transactions/{transactionId}/reject') {
      const txId = pathParameters?.transactionId;
      if (!txId) throw new DomainError('Missing transactionId', 'VALIDATION_ERROR');
      const input = JSON.parse(body || '{}');
      const result = await commercialService.rejectTransaction(ctx, txId, input.reason);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    if (routeKey === 'POST /commercial/transactions/{transactionId}/settlement') {
      const txId = pathParameters?.transactionId;
      if (!txId) throw new DomainError('Missing transactionId', 'VALIDATION_ERROR');
      const input = JSON.parse(body || '{}');
      const result = await commercialService.createSettlement(ctx, {
        transactionId: txId,
        amount: input.amount,
      });
      return { statusCode: 201, body: JSON.stringify(result) };
    }

    if (routeKey === 'POST /settlements/{settlementId}/confirm-simulated') {
      const sid = pathParameters?.settlementId;
      if (!sid) throw new DomainError('Missing settlementId', 'VALIDATION_ERROR');
      const result = await commercialService.confirmSimulatedSettlement(ctx, sid);
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
