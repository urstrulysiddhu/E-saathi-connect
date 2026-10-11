import {
  buildAuthorizationContext,
  requirePermission,
  requireOrganization,
} from '../src/shared/authorization';
import { ApiGatewayJwtEvent } from '../src/domain/identity';

const createMockEvent = (
  sub: string,
  customClaims: Record<string, string> = {}
): ApiGatewayJwtEvent => ({
  requestContext: {
    requestId: 'test-req-id',
    authorizer: {
      jwt: {
        claims: { sub, ...customClaims },
      },
    },
  },
});

describe('Authorization Security Matrix', () => {
  it('Test G: Unauthenticated request throws 401', async () => {
    // Simulated unauthenticated event with missing sub
    const event = createMockEvent('');
    await expect(buildAuthorizationContext(event)).rejects.toThrow('Unauthorized');
  });

  it('Test A: User from ORG-A accesses ORG-A resource (ALLOW)', async () => {
    const event = createMockEvent('user123', { 'custom:org': 'ORG-A', 'custom:role': 'HUB' });
    const ctx = await buildAuthorizationContext(event);
    expect(() => requireOrganization(ctx, 'ORG-A')).not.toThrow();
  });

  it('Test B: User from ORG-A accesses ORG-B resource (FORBIDDEN)', async () => {
    const event = createMockEvent('user123', { 'custom:org': 'ORG-A', 'custom:role': 'HUB' });
    const ctx = await buildAuthorizationContext(event);
    expect(() => requireOrganization(ctx, 'ORG-B')).toThrow('Cross-organization access forbidden');
  });

  it('Test C: Consumer attempts collector operation (FORBIDDEN)', async () => {
    const event = createMockEvent('user123', { 'custom:role': 'CONSUMER' });
    const ctx = await buildAuthorizationContext(event);
    // custody:accept is a collector permission
    expect(() => requirePermission(ctx, 'custody:accept')).toThrow('Missing required permission');
  });

  it('Test D: Collector attempts hub-only operation (FORBIDDEN)', async () => {
    const event = createMockEvent('user123', { 'custom:role': 'COLLECTOR' });
    const ctx = await buildAuthorizationContext(event);
    // custody:assess is a hub permission
    expect(() => requirePermission(ctx, 'custody:assess')).toThrow('Missing required permission');
  });

  it('Test E: Suspended actor attempts protected operation (FORBIDDEN)', async () => {
    const event = createMockEvent('user123', { 'custom:role': 'HUB', 'custom:suspended': 'true' });
    const ctx = await buildAuthorizationContext(event);
    // even though HUB has device:read, the actor is suspended
    expect(() => requirePermission(ctx, 'device:read')).toThrow('Actor is SUSPENDED');
  });

  it('Test H: Authenticated user without required permission (403)', async () => {
    const event = createMockEvent('user123', { 'custom:role': 'CONSUMER' });
    const ctx = await buildAuthorizationContext(event);
    expect(() => requirePermission(ctx, 'admin:manage')).toThrow('Missing required permission');
  });

  it('Test I & J: Forged identities in client payload are ignored', async () => {
    // The server derives actorId and organizationId from the JWT, not the request body.
    const event = createMockEvent('true-user', { 'custom:org': 'REAL-ORG' });
    const ctx = await buildAuthorizationContext(event);

    // Malicious client body: { actorId: 'admin', organizationId: 'OTHER-ORG' }
    // The context built MUST use the real values
    expect(ctx.actorId).toBe('actor_true-user');
    expect(ctx.organizationId).toBe('REAL-ORG');

    // Attempting to access OTHER-ORG will fail because the context has REAL-ORG
    expect(() => requireOrganization(ctx, 'OTHER-ORG')).toThrow(
      'Cross-organization access forbidden'
    );
  });
});
