import { logger } from '../shared/logger';

export interface ApiGatewayEvent {
  requestContext?: {
    requestId?: string;
  };
}

export const handler = async (event: ApiGatewayEvent) => {
  logger.info('Placeholder function invoked', { eventId: event.requestContext?.requestId });
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'e-Saathi Connect Foundation API' }),
  };
};
