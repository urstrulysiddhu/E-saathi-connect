import { PickupRequestService } from '../src/domain/pickup-request-service';
import { PickupRequestRepository } from '../src/infrastructure/repositories/pickup-request-repository';
import { DeviceRepository } from '../src/infrastructure/repositories/device-repository';
import { AuthorizationContext } from '../src/domain/identity';
import { Device, PickupRequest } from '@e-saathi/core';

class MockRequestRepo extends PickupRequestRepository {
  public requests: Record<string, PickupRequest> = {};

  async save(request: PickupRequest) {
    this.requests[request.requestId] = { ...request };
  }

  async getById(requestId: string) {
    return this.requests[requestId] || null;
  }

  async getPendingRequests() {
    const pending = Object.values(this.requests).filter((r) => r.status === 'PENDING');
    return { items: pending };
  }

  async listByConsumerActor(actorId: string) {
    return Object.values(this.requests).filter((r) => r.consumerActorId === actorId);
  }

  async getByCollectorOrg(orgId: string) {
    return Object.values(this.requests).filter((r) => r.assignedCollectorOrganizationId === orgId);
  }
}

class MockDeviceRepo extends DeviceRepository {
  public devices: Record<string, Device> = {};
  async getById(id: string) { return this.devices[id] || null; }
  async getByIds(ids: string[]) {
    const map = new Map<string, Device>();
    for (const id of ids) {
      if (this.devices[id]) map.set(id, this.devices[id]);
    }
    return map;
  }
}

describe('PickupRequestService', () => {
  let service: PickupRequestService;
  let requestRepo: MockRequestRepo;
  let deviceRepo: MockDeviceRepo;

  const consumerCtx: AuthorizationContext = {
    subject: 'sub-1', userId: 'usr-1', actorId: 'act-c', role: 'CONSUMER',
    permissions: [], actorStatus: 'ACTIVE', membershipStatus: 'ACTIVE', requestId: 'req-1'
  };

  const collectorCtx: AuthorizationContext = {
    subject: 'sub-2', userId: 'usr-2', actorId: 'act-coll', organizationId: 'ORG-C', role: 'COLLECTOR',
    permissions: [], actorStatus: 'ACTIVE', membershipStatus: 'ACTIVE', requestId: 'req-2'
  };

  beforeEach(() => {
    requestRepo = new MockRequestRepo();
    deviceRepo = new MockDeviceRepo();
    service = new PickupRequestService(requestRepo as unknown as PickupRequestRepository, deviceRepo as unknown as DeviceRepository);

    deviceRepo.devices['dev-1'] = {
      deviceId: 'dev-1', category: 'MOBILE_PHONE', condition: 'WORKING',
      registeredByActorId: 'act-c',
      lifecycleState: 'CREATED', dataSafetyState: 'NOT_VERIFIED',
      version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  });

  it('allows consumer to create a pickup request', async () => {
    const req = await service.createRequest(consumerCtx, {
      deviceId: 'dev-1', pickupAddress: '123 Fake St', pickupDate: '2026-12-01'
    });
    expect(req.status).toBe('PENDING');
    expect(req.consumerActorId).toBe('act-c');
    expect(requestRepo.requests[req.requestId]).toBeDefined();
  });

  it('rejects creation if device state is not CREATED', async () => {
    deviceRepo.devices['dev-1'].lifecycleState = 'HANDED_OVER';
    await expect(service.createRequest(consumerCtx, {
      deviceId: 'dev-1', pickupAddress: 'abc', pickupDate: '2026-12-01'
    })).rejects.toThrow('Device is not eligible for pickup');
  });

  it('allows collector to retrieve pending requests', async () => {
    await service.createRequest(consumerCtx, { deviceId: 'dev-1', pickupAddress: 'x', pickupDate: 'y' });
    const pending = await service.getCollectorRequests(collectorCtx);
    expect(pending.items.length).toBe(1);
    expect(pending.items[0].status).toBe('PENDING');
  });

  it('allows collector to accept a pending request', async () => {
    const req = await service.createRequest(consumerCtx, { deviceId: 'dev-1', pickupAddress: 'x', pickupDate: 'y' });
    const accepted = await service.acceptRequest(collectorCtx, req.requestId);
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.assignedCollectorOrganizationId).toBe('ORG-C');
    expect(accepted.assignedCollectorActorId).toBe('act-coll');
  });

  it('allows collector to reject a request', async () => {
    const req = await service.createRequest(consumerCtx, { deviceId: 'dev-1', pickupAddress: 'x', pickupDate: 'y' });
    const rejected = await service.rejectRequest(collectorCtx, req.requestId, { reason: 'Too far' });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Too far');
    expect(rejected.rejectedByOrganizationId).toBe('ORG-C');
    expect(rejected.assignedCollectorOrganizationId).toBeUndefined();
  });

  it('allows consumer to escalate/reassign a rejected request', async () => {
    const req = await service.createRequest(consumerCtx, { deviceId: 'dev-1', pickupAddress: 'x', pickupDate: 'y' });
    await service.rejectRequest(collectorCtx, req.requestId, { reason: 'No capacity' });
    
    const escalated = await service.escalateRequest(consumerCtx, req.requestId);
    expect(escalated.status).toBe('PENDING');
    expect(escalated.rejectionReason).toBe('No capacity'); // retained for history
  });
});
