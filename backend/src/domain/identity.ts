import { ActorRole, Permission, ActorStatus, MembershipStatus } from '@e-saathi/core';

export interface AuthorizationContext {
  subject: string;
  userId: string;
  actorId: string;
  organizationId?: string;
  role: ActorRole;
  permissions: Permission[];
  actorStatus: ActorStatus;
  membershipStatus?: MembershipStatus;
  requestId: string;
}

export interface ApiGatewayJwtEvent {
  requestContext: {
    requestId: string;
    authorizer: {
      jwt: {
        claims: Record<string, string | number | boolean | string[]>;
      };
    };
  };
}

export const extractSubject = (event: ApiGatewayJwtEvent): string => {
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub || typeof sub !== 'string') {
    throw new Error('Missing or invalid sub claim in JWT');
  }
  return sub;
};
