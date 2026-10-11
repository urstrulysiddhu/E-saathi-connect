import { PickupRequestRepository } from '../infrastructure/repositories/pickup-request-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import {
  PickupRequest,
  CreatePickupRequestInput,
  RejectPickupRequestInput,
  DomainError,
} from '@e-saathi/core';
import { AuthorizationContext } from './identity';
import { v4 as uuidv4 } from 'uuid';

export class PickupRequestService {
  constructor(
    private requestRepo: PickupRequestRepository,
    private deviceRepo: DeviceRepository
  ) {}

  async createRequest(
    ctx: AuthorizationContext,
    input: CreatePickupRequestInput
  ): Promise<PickupRequest> {
    if (ctx.role !== 'CONSUMER' && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Only consumers can create pickup requests', 'FORBIDDEN');
    }

    const device = await this.deviceRepo.getById(input.deviceId);
    if (!device) throw new DomainError('Device not found', 'NOT_FOUND');

    if (device.registeredByActorId !== ctx.actorId && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Unauthorized to request pickup for this device', 'FORBIDDEN');
    }

    if (device.lifecycleState !== 'CREATED') {
      throw new DomainError('Device is not eligible for pickup', 'VALIDATION_ERROR');
    }

    const request: PickupRequest = {
      requestId: uuidv4(),
      deviceId: input.deviceId,
      consumerActorId: ctx.actorId,
      status: 'PENDING',
      pickupAddress: input.pickupAddress,
      pickupDate: input.pickupDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await this.requestRepo.save(request);
    return request;
  }

  async getCollectorRequests(ctx: AuthorizationContext) {
    if (ctx.role !== 'COLLECTOR' && !ctx.permissions.includes('admin:read')) {
      throw new DomainError('Unauthorized to view collector requests', 'FORBIDDEN');
    }
    
    // Fetch pending requests
    const pending = await this.requestRepo.getPendingRequests();
    
    // Fetch requests assigned to this collector org
    let assigned: PickupRequest[] = [];
    if (ctx.organizationId) {
      assigned = await this.requestRepo.getByCollectorOrg(ctx.organizationId);
    }
    
    // Deduplicate requests
    const requestMap = new Map<string, PickupRequest>();
    for (const req of [...pending.items, ...assigned]) {
      requestMap.set(req.requestId, req);
    }
    const allRequests = Array.from(requestMap.values());
    
    // Batch enrich with securely filtered device details
    let deviceMap = new Map<string, any>();
    if (typeof this.deviceRepo.getByIds === 'function') {
      const deviceIds = allRequests.map((r) => r.deviceId);
      deviceMap = await this.deviceRepo.getByIds(deviceIds);
    }

    const enriched = await Promise.all(
      allRequests.map(async (req) => {
        const device = deviceMap.get(req.deviceId) || (await this.deviceRepo.getById(req.deviceId));
        return {
          ...req,
          deviceDetails: device ? {
            deviceId: device.deviceId,
            category: device.category,
            brand: device.brand,
            model: device.model,
            condition: device.condition,
            description: device.description,
            lifecycleState: device.lifecycleState,
          } : undefined
        };
      })
    );

    return { items: enriched };
  }

  async acceptRequest(ctx: AuthorizationContext, requestId: string): Promise<PickupRequest> {
    if (ctx.role !== 'COLLECTOR') {
      throw new DomainError('Only collectors can accept requests', 'FORBIDDEN');
    }
    if (!ctx.organizationId) {
      throw new DomainError('Collector organization required', 'FORBIDDEN');
    }

    const request = await this.requestRepo.getById(requestId);
    if (!request) throw new DomainError('Request not found', 'NOT_FOUND');

    if (request.status !== 'PENDING') {
      throw new DomainError(`Cannot accept request in ${request.status} status`, 'VALIDATION_ERROR');
    }

    request.status = 'ACCEPTED';
    request.assignedCollectorOrganizationId = ctx.organizationId;
    request.assignedCollectorActorId = ctx.actorId;
    request.updatedAt = new Date().toISOString();
    request.version += 1;

    await this.requestRepo.save(request);
    return request;
  }

  async rejectRequest(
    ctx: AuthorizationContext,
    requestId: string,
    input: RejectPickupRequestInput
  ): Promise<PickupRequest> {
    if (ctx.role !== 'COLLECTOR') {
      throw new DomainError('Only collectors can reject requests', 'FORBIDDEN');
    }
    if (!ctx.organizationId) {
      throw new DomainError('Collector organization required', 'FORBIDDEN');
    }

    const request = await this.requestRepo.getById(requestId);
    if (!request) throw new DomainError('Request not found', 'NOT_FOUND');

    // Collector can reject if they already accepted it, OR they can reject it from the pending pool
    // (though rejecting from pending pool means it's rejected for everyone, which might not make sense unless they are the designated collector).
    // Let's assume they have to have it assigned, OR we allow anyone to reject it.
    // The requirement says: "Recovery: after rejection, make the request eligible for reassignment or escalation to another eligible collector."
    // So if it was ACCEPTED by them, they can reject it, placing it back in PENDING or REJECTED.
    // "Persist the rejecting actor, organization, timestamp and reason."
    
    if (request.assignedCollectorOrganizationId && request.assignedCollectorOrganizationId !== ctx.organizationId) {
      throw new DomainError('Cannot reject a request assigned to another organization', 'FORBIDDEN');
    }

    // Instead of terminal REJECTED, the requirement says "make the request eligible for reassignment".
    // Wait, "allow rejection with a mandatory reason... The consumer must see exactly which collector rejected".
    // We can transition it to REJECTED. Then Consumer can re-issue it, or the system can automatically put it in PENDING.
    // Let's transition to REJECTED.
    
    request.status = 'REJECTED';
    request.rejectionReason = input.reason;
    request.rejectedByActorId = ctx.actorId;
    request.rejectedByOrganizationId = ctx.organizationId;
    
    // Clear assignments
    request.assignedCollectorOrganizationId = undefined;
    request.assignedCollectorActorId = undefined;
    
    request.updatedAt = new Date().toISOString();
    request.version += 1;

    await this.requestRepo.save(request);
    return request;
  }

  async escalateRequest(ctx: AuthorizationContext, requestId: string): Promise<PickupRequest> {
    // Escalate puts a rejected request back into pending pool
    if (ctx.role !== 'CONSUMER') {
      throw new DomainError('Only consumers can escalate/reassign their requests', 'FORBIDDEN');
    }

    const request = await this.requestRepo.getById(requestId);
    if (!request) throw new DomainError('Request not found', 'NOT_FOUND');
    if (request.consumerActorId !== ctx.actorId) {
      throw new DomainError('Not authorized', 'FORBIDDEN');
    }
    if (request.status !== 'REJECTED') {
      throw new DomainError('Can only escalate REJECTED requests', 'VALIDATION_ERROR');
    }

    request.status = 'PENDING';
    request.updatedAt = new Date().toISOString();
    request.version += 1;

    await this.requestRepo.save(request);
    return request;
  }

  async listConsumerRequests(ctx: AuthorizationContext): Promise<PickupRequest[]> {
    if (ctx.role !== 'CONSUMER') {
      throw new DomainError('Unauthorized', 'FORBIDDEN');
    }
    return this.requestRepo.listByConsumerActor(ctx.actorId);
  }
}
