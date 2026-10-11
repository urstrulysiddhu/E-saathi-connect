import { DeviceService } from '../src/domain/device-service';
import { DeviceRepository } from '../src/infrastructure/repositories/device-repository';
import { PickupRequestRepository } from '../src/infrastructure/repositories/pickup-request-repository';
import { CommercialRepository } from '../src/infrastructure/repositories/commercial-repository';
import { RoutingRepository } from '../src/infrastructure/repositories/routing-repository';
import { AuthorizationContext } from '../src/domain/identity';
import { DeviceCreateInput, Device } from '@e-saathi/core';

// Mock Repositories
class MockDeviceRepository extends DeviceRepository {
  public devices: Record<string, Device> = {};
  public idempotencyKeys: Record<string, string> = {};

  async create(device: Device) {
    if (this.devices[device.deviceId]) throw new Error('ConditionalCheckFailedException');
    this.devices[device.deviceId] = device;
  }

  async getById(deviceId: string) {
    return this.devices[deviceId] || null;
  }

  async listByOrganization(orgId: string) {
    const items = Object.values(this.devices).filter(
      (d: Device) => d.registeredByOrganizationId === orgId
    );
    return { items };
  }

  async listByActor(actorId: string) {
    const items = Object.values(this.devices).filter(
      (d: Device) => d.registeredByActorId === actorId
    );
    return { items };
  }

  async update(deviceId: string, expectedVersion: number, updates: Partial<Device>) {
    const device = this.devices[deviceId];
    if (!device || device.version !== expectedVersion) {
      throw new Error('ConditionalCheckFailedException');
    }
    const updated = { ...device, ...updates, version: expectedVersion + 1 };
    this.devices[deviceId] = updated;
    return updated;
  }

  async checkIdempotency(key: string, orgId: string) {
    return this.idempotencyKeys[`${orgId}#${key}`] || null;
  }

  async saveIdempotency(key: string, orgId: string, deviceId: string) {
    this.idempotencyKeys[`${orgId}#${key}`] = deviceId;
  }

  async listByCustodian(organizationId: string, _limit?: number, _nextToken?: string) {
    const items = Object.values(this.devices).filter(
      (d) => d.currentCustodianOrganizationId === organizationId || d.registeredByOrganizationId === organizationId
    );
    return { items, nextToken: undefined };
  }
}

class MockPickupRequestRepository extends PickupRequestRepository {
  public requests: any[] = [];
  async getByCollectorOrg(orgId: string): Promise<any[]> {
    return this.requests.filter((r) => r.assignedCollectorOrganizationId === orgId);
  }
}

class MockCommercialRepository extends CommercialRepository {
  public transactions: any[] = [];
  async getTransactionsByDevice(deviceId: string): Promise<any[]> {
    return this.transactions.filter((tx) => tx.deviceId === deviceId);
  }
}

class MockRoutingRepository extends RoutingRepository {
  public decisions: any[] = [];
  async listByDevice(deviceId: string): Promise<any[]> {
    return this.decisions.filter((d) => d.deviceId === deviceId);
  }
}

describe('DeviceService', () => {
  let repository: MockDeviceRepository;
  let pickupRepo: MockPickupRequestRepository;
  let commercialRepo: MockCommercialRepository;
  let routingRepo: MockRoutingRepository;
  let service: DeviceService;

  const mockContext: AuthorizationContext = {
    subject: 'sub-123',
    userId: 'usr-123',
    actorId: 'act-123',
    organizationId: 'ORG-A',
    role: 'COLLECTOR',
    permissions: ['device:create', 'device:read', 'device:update'],
    actorStatus: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    requestId: 'req-1',
  };

  const mockInput: DeviceCreateInput = {
    category: 'MOBILE_PHONE',
    brand: 'Samsung',
    model: 'Galaxy S21',
    imei: '123456789012345',
    idempotencyKey: 'idem-1',
  };

  beforeEach(() => {
    repository = new MockDeviceRepository();
    pickupRepo = new MockPickupRequestRepository();
    commercialRepo = new MockCommercialRepository();
    routingRepo = new MockRoutingRepository();
    service = new DeviceService(repository, pickupRepo, commercialRepo, routingRepo);
  });

  it('creates a device with correct defaults and normalizes identifiers', async () => {
    const device = await service.createDevice(mockContext, {
      ...mockInput,
      serialNumber: '  abc-123  ',
    });

    expect(device.deviceId).toBeDefined();
    expect(device.lifecycleState).toBe('CREATED');
    expect(device.dataSafetyState).toBe('NOT_VERIFIED');
    expect(device.version).toBe(1);
    expect(device.serialNumber).toBe('ABC-123'); // Normalized upper and trimmed
    expect(device.imei).toBe('123456789012345');
    expect(device.registeredByOrganizationId).toBe('ORG-A');
  });

  it('rejects malformed IMEI', async () => {
    await expect(
      service.createDevice(mockContext, {
        ...mockInput,
        imei: 'invalid-imei',
      })
    ).rejects.toThrow('Invalid IMEI format');
  });

  it('returns same device on idempotent request', async () => {
    const device1 = await service.createDevice(mockContext, mockInput);
    const device2 = await service.createDevice(mockContext, mockInput);
    expect(device1.deviceId).toBe(device2.deviceId);
  });

  describe('Authorization and Tenancy Isolation (getDevice)', () => {
    it('prevents cross-org read unless admin', async () => {
      const device = await service.createDevice(mockContext, mockInput);

      const otherContext: AuthorizationContext = {
        ...mockContext,
        organizationId: 'ORG-B',
      };

      await expect(service.getDevice(otherContext, device.deviceId)).rejects.toThrow(
        'Device not found'
      );

      // Admin can read cross-org
      const adminContext: AuthorizationContext = {
        ...mockContext,
        role: 'ADMIN',
        organizationId: 'ADMIN_ORG',
      };
      const adminRead = await service.getDevice(adminContext, device.deviceId);
      expect(adminRead.deviceId).toBe(device.deviceId);
    });

    it('allows consumer owner to read own device, denies unrelated consumer', async () => {
      const consumerA: AuthorizationContext = {
        ...mockContext,
        role: 'CONSUMER',
        actorId: 'consumer-actor-A',
        organizationId: undefined as any,
      };
      const consumerB: AuthorizationContext = {
        ...mockContext,
        role: 'CONSUMER',
        actorId: 'consumer-actor-B',
        organizationId: undefined as any,
      };

      const device = await service.createDevice(consumerA, mockInput);

      // Positive: Consumer A reads own device
      const readDev = await service.getDevice(consumerA, device.deviceId);
      expect(readDev.deviceId).toBe(device.deviceId);

      // Negative: Unrelated Consumer B cannot read Consumer A's device
      await expect(service.getDevice(consumerB, device.deviceId)).rejects.toThrow('Device not found');
    });

    it('allows collector with assigned pickup request to read device, denies unrelated collector', async () => {
      const consumer: AuthorizationContext = {
        ...mockContext,
        role: 'CONSUMER',
        actorId: 'consumer-actor-1',
        organizationId: undefined as any,
      };
      const assignedCollector: AuthorizationContext = {
        ...mockContext,
        role: 'COLLECTOR',
        actorId: 'collector-assigned',
        organizationId: 'COLLECTOR_ORG_A',
      };
      const unrelatedCollector: AuthorizationContext = {
        ...mockContext,
        role: 'COLLECTOR',
        actorId: 'collector-unrelated',
        organizationId: 'COLLECTOR_ORG_B',
      };

      const device = await service.createDevice(consumer, mockInput);

      // Before assignment: Collector A cannot read device
      await expect(service.getDevice(assignedCollector, device.deviceId)).rejects.toThrow('Device not found');

      // Assign pickup request to Collector Org A
      pickupRepo.requests.push({
        requestId: 'req-pickup-1',
        deviceId: device.deviceId,
        assignedCollectorOrganizationId: 'COLLECTOR_ORG_A',
        status: 'ACCEPTED',
      });

      // Positive: Assigned Collector reads device
      const readAssigned = await service.getDevice(assignedCollector, device.deviceId);
      expect(readAssigned.deviceId).toBe(device.deviceId);

      // Negative: Unrelated Collector from Org B cannot read device
      await expect(service.getDevice(unrelatedCollector, device.deviceId)).rejects.toThrow('Device not found');
    });

    it('allows destination with commercial transaction to read device, denies unrelated destination', async () => {
      const consumer: AuthorizationContext = {
        ...mockContext,
        role: 'CONSUMER',
        actorId: 'consumer-actor-1',
        organizationId: undefined as any,
      };
      const routedDest: AuthorizationContext = {
        ...mockContext,
        role: 'DESTINATION',
        actorId: 'dest-actor-1',
        organizationId: 'DEST_ORG_A',
      };
      const unrelatedDest: AuthorizationContext = {
        ...mockContext,
        role: 'DESTINATION',
        actorId: 'dest-actor-2',
        organizationId: 'DEST_ORG_B',
      };

      const device = await service.createDevice(consumer, mockInput);

      // Before transaction: Destination cannot read device
      await expect(service.getDevice(routedDest, device.deviceId)).rejects.toThrow('Device not found');

      // Create commercial proposal targeting DEST_ORG_A
      commercialRepo.transactions.push({
        transactionId: 'tx-123',
        deviceId: device.deviceId,
        destinationOrganizationId: 'DEST_ORG_A',
        transactionStatus: 'PROPOSED',
      });

      // Positive: Targeted Destination reads device
      const readDest = await service.getDevice(routedDest, device.deviceId);
      expect(readDest.deviceId).toBe(device.deviceId);

      // Negative: Unrelated Destination cannot read device
      await expect(service.getDevice(unrelatedDest, device.deviceId)).rejects.toThrow('Device not found');
    });

    it('allows custodian organization to read device in its custody', async () => {
      const consumer: AuthorizationContext = {
        ...mockContext,
        role: 'CONSUMER',
        actorId: 'consumer-actor-1',
        organizationId: undefined as any,
      };
      const custodianOrgCtx: AuthorizationContext = {
        ...mockContext,
        role: 'HUB',
        actorId: 'hub-actor-1',
        organizationId: 'HUB_ORG_1',
      };

      const device = await service.createDevice(consumer, mockInput);
      device.currentCustodianOrganizationId = 'HUB_ORG_1';

      const readCustodian = await service.getDevice(custodianOrgCtx, device.deviceId);
      expect(readCustodian.deviceId).toBe(device.deviceId);
    });
  });

  it('allows updates with optimistic concurrency', async () => {
    const device = await service.createDevice(mockContext, mockInput);

    // First update works
    const updated = await service.updateDevice(mockContext, device.deviceId, 1, {
      condition: 'WORKING',
    });
    expect(updated.version).toBe(2);
    expect(updated.condition).toBe('WORKING');

    // Second update with stale version fails
    await expect(
      service.updateDevice(mockContext, device.deviceId, 1, { condition: 'DAMAGED' })
    ).rejects.toThrow();
  });

  it('prevents consumer from updating protected fields via ordinary update endpoint', async () => {
    // The device update interface does not accept `lifecycleState` or `currentCustodian`
    // TypeScript typing protects this at compile time.
    const device = await service.createDevice(mockContext, mockInput);

    // We can only pass DeviceUpdateInput which doesn't have lifecycleState
    const input: Partial<Device> = { lifecycleState: 'PROCESSED' as const };

    // In our mock, the repository doesn't filter, but the service explicitly maps fields
    const updated = await service.updateDevice(mockContext, device.deviceId, 1, input);

    // Check that lifecycleState was NOT updated
    expect((updated as unknown as Record<string, string>).lifecycleState).toBe('CREATED');
  });

  it('consumer creates a device without organization', async () => {
    const consumerCtx: AuthorizationContext = {
      ...mockContext,
      role: 'CONSUMER',
      organizationId: undefined as any,
    };
    const device = await service.createDevice(consumerCtx, mockInput);
    
    expect(device.deviceId).toBeDefined();
    expect(device.registeredByActorId).toBe('act-123'); // consumer device is persisted with actor ownership
    expect(device.registeredByOrganizationId).toBeUndefined(); // consumer-created device does not require GSI1 organization ownership
  });

  it('unauthorized roles without organization are rejected', async () => {
    const collectorCtx: AuthorizationContext = {
      ...mockContext,
      role: 'COLLECTOR',
      organizationId: undefined as any,
    };
    await expect(service.createDevice(collectorCtx, mockInput)).rejects.toThrow('Organization ID is required to create a device');
  });

  it('lists devices for a consumer actor dynamically', async () => {
    const consumerCtx: AuthorizationContext = {
      ...mockContext,
      role: 'CONSUMER',
      organizationId: undefined as any,
    };

    // Create device as consumer
    const device = await service.createDevice(consumerCtx, mockInput);

    const listResult = await service.listDevices(consumerCtx, { limit: 10 });
    expect(listResult.items.length).toBe(1);
    expect(listResult.items[0].deviceId).toBe(device.deviceId);

    // Org A lists should be empty since consumer has no org
    const orgResult = await service.listDevices(mockContext, { limit: 10 });
    expect(orgResult.items.length).toBe(0);
  });
});
