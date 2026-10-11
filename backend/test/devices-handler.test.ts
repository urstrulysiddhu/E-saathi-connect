import { handler } from '../src/functions/devices';

jest.mock('../src/infrastructure/repositories/device-repository', () => {
  return {
    DeviceRepository: jest.fn().mockImplementation(() => ({
      listByActor: jest.fn().mockResolvedValue({
        items: [{ deviceId: 'test-device' }],
        nextToken: undefined,
      }),
      listByOrganization: jest.fn().mockResolvedValue({
        items: [{ deviceId: 'org-device' }],
        nextToken: undefined,
      }),
      checkIdempotency: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Devices Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createEvent = (method: string, customRole: string, body?: string, orgId?: string) => ({
    requestContext: {
      http: { method },
      requestId: 'test-request-id',
      authorizer: {
        jwt: {
          claims: {
            sub: 'test-user-123',
            'custom:role': customRole,
            ...(orgId && { 'custom:org': orgId }),
          },
        },
      },
    },
    httpMethod: method,
    body,
  });

  it('GET /devices: should not crash if body is an empty whitespace string', async () => {
    const event = createEvent('GET', 'CONSUMER', ' ');
    const response = await handler(event as any);
    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.items[0].deviceId).toBe('test-device');
  });

  it('POST /devices: consumer should create device successfully even if role is lowercase', async () => {
    const payload = {
      category: 'MOBILE_PHONE',
      brand: 'Apple',
      idempotencyKey: 'idemp-123',
    };
    const event = createEvent('POST', 'consumer', JSON.stringify(payload));
    const response = await handler(event as any);
    if (response.statusCode !== 201) {
      console.log('ACTUAL 403 RESPONSE BODY:', response.body);
    }
    expect(response.statusCode).toBe(201);
  });

  it('POST /devices: org user should be FORBIDDEN from creating devices (no permission)', async () => {
    const payload = {
      category: 'MOBILE_PHONE',
      brand: 'Apple',
      idempotencyKey: 'idemp-123',
    };
    const event = createEvent('POST', 'HUB', JSON.stringify(payload), 'ORG-123');
    const response = await handler(event as any);
    expect(response.statusCode).toBe(403);
  });

  it('POST /devices: non-consumer without org should be FORBIDDEN', async () => {
    const payload = {
      category: 'MOBILE_PHONE',
      brand: 'Apple',
      idempotencyKey: 'idemp-123',
    };
    const event = createEvent('POST', 'HUB', JSON.stringify(payload));
    const response = await handler(event as any);
    expect(response.statusCode).toBe(403);
  });
});
