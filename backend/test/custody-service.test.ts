import { CustodyService } from '../src/domain/custody-service';
import { CustodyRepository } from '../src/infrastructure/repositories/custody-repository';
import { DeviceRepository } from '../src/infrastructure/repositories/device-repository';
import { AuthorizationContext } from '../src/domain/identity';
import { Device, CustodyEvent, DomainError } from '@e-saathi/core';

class MockDeviceRepo extends DeviceRepository {
  public devices: Record<string, Device> = {};

  async getById(deviceId: string) {
    return this.devices[deviceId] || null;
  }
}

class MockCustodyRepo extends CustodyRepository {
  public events: CustodyEvent[] = [];
  public idemKeys: Record<string, { eventId: string; deviceId: string }> = {};

  async appendEvent(device: Device, event: CustodyEvent, expectedVersion: number) {
    // Atomicity sim:
    if (expectedVersion !== device.version) {
      throw new DomainError('Device update conflict (stale version)', 'CONFLICT');
    }
    this.events.push(event);
  }

  async getDeviceTimeline(deviceId: string) {
    return this.events
      .filter((e) => e.deviceId === deviceId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  async getLatestEvent(deviceId: string) {
    const timeline = await this.getDeviceTimeline(deviceId);
    return timeline.length > 0 ? timeline[timeline.length - 1] : null;
  }

  async checkIdempotency(
    key: string,
    orgId: string
  ): Promise<{ eventId: string; deviceId: string } | null> {
    return (
      (this.idemKeys[`${orgId}#${key}`] as { eventId: string; deviceId: string } | undefined) ||
      null
    );
  }
}

describe('CustodyService', () => {
  let custodyRepo: MockCustodyRepo;
  let deviceRepo: MockDeviceRepo;
  let commercialRepo: any;
  let service: CustodyService;

  const mockCtx: AuthorizationContext = {
    subject: 'sub-1',
    userId: 'usr-1',
    actorId: 'act-1',
    organizationId: 'ORG-A',
    role: 'CONSUMER',
    permissions: ['custody:route', 'device:update'],
    actorStatus: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    requestId: 'req-1',
  };

  beforeEach(() => {
    custodyRepo = new MockCustodyRepo();
    deviceRepo = new MockDeviceRepo();
    commercialRepo = {
      getTransactionsByDevice: jest.fn().mockResolvedValue([]),
    };
    service = new CustodyService(custodyRepo, deviceRepo, commercialRepo);

    deviceRepo.devices['dev-1'] = {
      deviceId: 'dev-1',
      category: 'MOBILE_PHONE',
      condition: 'WORKING',
      registeredByActorId: 'act-1',
      registeredByOrganizationId: 'ORG-A',
      currentCustodianActorId: undefined,
      currentCustodianOrganizationId: undefined,
      lifecycleState: 'CREATED',
      dataSafetyState: 'NOT_VERIFIED',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
  });

  it('allows valid transition and creates chain genesis', async () => {
    const result = await service.transitionCustody(mockCtx, 'dev-1', {
      eventType: 'HANDOVER_INITIATED',
      expectedVersion: 1,
      idempotencyKey: 'idem-1',
    });

    expect(result.device.lifecycleState).toBe('HANDED_OVER');
    expect(result.version).toBe(2);
    expect(result.custodyEvent.previousEventHash).toBeNull();
    expect(result.custodyEvent.eventHash).toBeDefined();

    // Verify timeline
    const timeline = await service.getDeviceTimeline(
      { ...mockCtx, role: 'ADMIN', permissions: ['device:read'] },
      'dev-1'
    );
    expect(timeline.length).toBe(1);

    // Verify Chain
    const verification = await service.verifyDeviceCustodyChain(
      { ...mockCtx, role: 'ADMIN', permissions: ['device:read'] },
      'dev-1'
    );
    expect(verification.valid).toBe(true);
    expect(verification.eventsChecked).toBe(1);
  });

  it('rejects invalid role transition', async () => {
    const collectorCtx = {
      ...mockCtx,
      role: 'COLLECTOR' as const,
      actorId: 'act-2',
      organizationId: 'ORG-B',
    };
    await expect(
      service.transitionCustody(collectorCtx, 'dev-1', {
        eventType: 'HANDOVER_INITIATED',
        expectedVersion: 1,
        idempotencyKey: 'idem-2',
      })
    ).rejects.toThrow('Role COLLECTOR is not authorized');
  });

  it('detects concurrency conflict', async () => {
    await expect(
      service.transitionCustody(mockCtx, 'dev-1', {
        eventType: 'HANDOVER_INITIATED',
        expectedVersion: 99, // Stale
        idempotencyKey: 'idem-3',
      })
    ).rejects.toThrow('Device update conflict');
  });

  it('detects tampered chain', async () => {
    await service.transitionCustody(mockCtx, 'dev-1', {
      eventType: 'HANDOVER_INITIATED',
      expectedVersion: 1,
      idempotencyKey: 'idem-4',
    });

    deviceRepo.devices['dev-1'].version = 2; // Simulating successful update

    const collectorCtx = {
      ...mockCtx,
      role: 'COLLECTOR' as const,
      actorId: 'act-2',
      organizationId: 'ORG-B',
    };
    await service.transitionCustody(collectorCtx, 'dev-1', {
      eventType: 'HANDOVER_ACCEPTED',
      expectedVersion: 2,
      idempotencyKey: 'idem-5',
    });

    // Tamper with event 1
    custodyRepo.events[0].newLifecycleState = 'CLOSED';

    const verification = await service.verifyDeviceCustodyChain(
      { ...mockCtx, role: 'ADMIN', permissions: ['device:read'] },
      'dev-1'
    );
    expect(verification.valid).toBe(false);
  });

  it('allows admin to complete verification and close custody journey', async () => {
    deviceRepo.devices['dev-1'].lifecycleState = 'PROCESSED';
    deviceRepo.devices['dev-1'].version = 7;

    const adminCtx: AuthorizationContext = {
      ...mockCtx,
      role: 'ADMIN',
      actorId: 'admin-1',
      organizationId: 'ADMIN_ORG',
      permissions: ['custody:verify', 'custody:close'],
    };

    // 1. Admin verifies
    const verifyRes = await service.transitionCustody(adminCtx, 'dev-1', {
      eventType: 'VERIFICATION_COMPLETED',
      expectedVersion: 7,
      idempotencyKey: 'admin-ver-1',
    });
    expect(verifyRes.device.lifecycleState).toBe('VERIFIED');
    expect(verifyRes.version).toBe(8);
    deviceRepo.devices['dev-1'].lifecycleState = 'VERIFIED';
    deviceRepo.devices['dev-1'].version = 8;

    // 2. Admin closes journey
    const closeRes = await service.transitionCustody(adminCtx, 'dev-1', {
      eventType: 'CLOSURE_CONFIRMED',
      expectedVersion: 8,
      idempotencyKey: 'admin-close-1',
    });
    expect(closeRes.device.lifecycleState).toBe('CLOSED');
    expect(closeRes.version).toBe(9);
  });
});
