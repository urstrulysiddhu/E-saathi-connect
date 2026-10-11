import { NotificationService } from '../domain/notification-service';
import { NotificationRepository } from '../infrastructure/repositories/notification-repository';
import { buildAuthorizationContext } from '../shared/authorization';
import { ApiGatewayJwtEvent } from '../domain/identity';

const notificationRepo = new NotificationRepository();
const service = new NotificationService(notificationRepo);

export const handler = async (
  event: ApiGatewayJwtEvent & {
    httpMethod: string;
    path: string;
    pathParameters: Record<string, string | undefined> | null;
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

    if (method === 'GET' && path === '/notifications') {
      const result = await service.listMyNotifications(ctx);
      return { statusCode: 200, body: JSON.stringify({ items: result }) };
    }

    if (method === 'POST' && path.match(/^\/notifications\/[^/]+\/read$/)) {
      const notificationId = event.pathParameters?.notificationId || path.split('/')[2];
      await service.markAsRead(ctx, notificationId);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
