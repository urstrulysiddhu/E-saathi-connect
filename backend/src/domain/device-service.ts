import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { PickupRequestRepository } from '../infrastructure/repositories/pickup-request-repository';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { RoutingRepository } from '../infrastructure/repositories/routing-repository';
import { AuthorizationContext } from './identity';
import { requirePermission } from '../shared/authorization';
import {
  Device,
  DeviceCreateInput,
  DeviceUpdateInput,
  DeviceListQuery,
  DeviceListResult,
  DomainError,
} from '@e-saathi/core';
import * as crypto from 'crypto';
import { logger } from '../shared/logger';
import { ValuationService } from './valuation-service';

export class DeviceService {
  private valuationService = new ValuationService();

  constructor(
    private readonly repository: DeviceRepository,
    private readonly pickupRepo: PickupRequestRepository = new PickupRequestRepository(),
    private readonly commercialRepo: CommercialRepository = new CommercialRepository(),
    private readonly routingRepo: RoutingRepository = new RoutingRepository()
  ) {}

  async createDevice(ctx: AuthorizationContext, input: DeviceCreateInput): Promise<Device> {
    requirePermission(ctx, 'device:create');
    
    const normalizedRole = ctx.role?.toUpperCase();

    if (normalizedRole !== 'CONSUMER' && !ctx.organizationId) {
      throw new DomainError('Organization ID is required to create a device', 'FORBIDDEN');
    }

    // Normalizations
    const serialNumber = input.serialNumber?.trim().toUpperCase();
    const imei = input.imei?.trim();

    if (imei && !/^\d{15}$/.test(imei)) {
      throw new DomainError('Invalid IMEI format', 'VALIDATION_ERROR');
    }

    // Idempotency check
    if (!input.idempotencyKey) {
      throw new DomainError('Idempotency key is required', 'VALIDATION_ERROR');
    }

    // For idempotency, we use actorId for consumers, and organizationId for org users
    const idempotencyScopeId = normalizedRole === 'CONSUMER' ? ctx.actorId : ctx.organizationId!;

    const existingId = await this.repository.checkIdempotency(
      input.idempotencyKey,
      idempotencyScopeId
    );
    if (existingId) {
      const existingDevice = await this.repository.getById(existingId);
      if (existingDevice) {
        logger.info('Returning existing device for idempotency key', { deviceId: existingId });
        return existingDevice;
      }
    }

    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const device: Device = {
      deviceId,
      category: input.category,
      deviceType: input.deviceType,
      brand: input.brand,
      model: input.model,
      serialNumber,
      imei,
      assetTag: input.assetTag,
      description: input.description,
      condition: input.condition || 'UNKNOWN',
      indicativeValuation: this.valuationService.getValuation(input.brand, input.model, input.condition || 'UNKNOWN', input.category),

      registeredByActorId: ctx.actorId,
      // Consumer devices do not strictly require an organization, but can have one
      registeredByOrganizationId: normalizedRole === 'CONSUMER' ? undefined : ctx.organizationId,

      lifecycleState: 'CREATED',
      dataSafetyState: 'NOT_VERIFIED',

      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(device);

    // Save idempotency key
    try {
      await this.repository.saveIdempotency(input.idempotencyKey, idempotencyScopeId, deviceId);
    } catch (e) {
      logger.warn('Failed to save idempotency key', { error: e });
    }

    // Do not log sensitive identifiers like IMEI or full SN
    logger.info('Device created', {
      deviceId,
      actorId: ctx.actorId,
      organizationId: ctx.organizationId,
      category: device.category,
    });

    return device;
  }

  private async hasRelationship(
    ctx: AuthorizationContext,
    device: Device
  ): Promise<boolean> {
    const normalizedRole = ctx.role?.toUpperCase();

    // 1. Admin has global platform audit and verification access
    if (normalizedRole === 'ADMIN') {
      return true;
    }

    // 2. Direct owner / registering consumer (for consumer-registered devices)
    if (!device.registeredByOrganizationId && device.registeredByActorId === ctx.actorId) {
      return true;
    }

    // 3. Registering organization
    if (
      device.registeredByOrganizationId &&
      ctx.organizationId &&
      device.registeredByOrganizationId === ctx.organizationId
    ) {
      return true;
    }

    // 4. Current physical or legal custodian organization
    if (
      device.currentCustodianOrganizationId &&
      ctx.organizationId &&
      device.currentCustodianOrganizationId === ctx.organizationId
    ) {
      return true;
    }

    // Consumer role can only access devices they registered
    if (normalizedRole === 'CONSUMER') {
      return false;
    }

    // Strict tenant isolation: If registered by an organization and caller is from another org,
    // deny access unless custodian or admin
    if (device.registeredByOrganizationId && device.registeredByOrganizationId !== ctx.organizationId) {
      return false;
    }

    // 5. Collector: must have an assigned or active pickup request for this device
    if (normalizedRole === 'COLLECTOR' && ctx.organizationId) {
      try {
        const assignedRequests = await this.pickupRepo.getByCollectorOrg(ctx.organizationId);
        const hasMatchingRequest = assignedRequests.some(
          (req) => req.deviceId === device.deviceId
        );
        if (hasMatchingRequest) {
          return true;
        }
      } catch (err) {
        logger.warn('Failed to verify collector pickup relationship', { error: String(err) });
      }
      return false;
    }

    // 6. Destination: must have an active commercial transaction, routing decision, or custody
    if (normalizedRole === 'DESTINATION' && ctx.organizationId) {
      try {
        const txs = await this.commercialRepo.getTransactionsByDevice(device.deviceId);
        const hasMatchingTx = txs.some(
          (tx) => tx.destinationOrganizationId === ctx.organizationId
        );
        if (hasMatchingTx) {
          return true;
        }

        const routings = await this.routingRepo.listByDevice(device.deviceId);
        const hasMatchingRouting = routings.some(
          (r) => r.selectedDestinationId === ctx.organizationId
        );
        if (hasMatchingRouting) {
          return true;
        }
      } catch (err) {
        logger.warn('Failed to verify destination relationship', { error: String(err) });
      }
      return false;
    }

    // 7. Hub: must have commercial transaction, routing decision, or custody
    if (normalizedRole === 'HUB' && ctx.organizationId) {
      try {
        const txs = await this.commercialRepo.getTransactionsByDevice(device.deviceId);
        const hasMatchingTx = txs.some(
          (tx) =>
            tx.sourceOrganizationId === ctx.organizationId ||
            tx.proposedByOrganizationId === ctx.organizationId
        );
        if (hasMatchingTx) {
          return true;
        }

        const routings = await this.routingRepo.listByDevice(device.deviceId);
        const hasMatchingRouting = routings.some(
          (r) => r.sourceOrganizationId === ctx.organizationId
        );
        if (hasMatchingRouting) {
          return true;
        }
      } catch (err) {
        logger.warn('Failed to verify hub relationship', { error: String(err) });
      }
      return false;
    }

    return false;
  }

  async getDevice(ctx: AuthorizationContext, deviceId: string): Promise<Device> {
    requirePermission(ctx, 'device:read');

    const device = await this.repository.getById(deviceId);
    if (!device) {
      throw new DomainError('Device not found', 'NOT_FOUND');
    }

    const authorized = await this.hasRelationship(ctx, device);
    if (!authorized) {
      throw new DomainError('Device not found', 'NOT_FOUND');
    }

    return device;
  }

  async listDevices(ctx: AuthorizationContext, query: DeviceListQuery): Promise<DeviceListResult> {
    requirePermission(ctx, 'device:read');
    
    const normalizedRole = ctx.role?.toUpperCase();

    if (normalizedRole === 'ADMIN' || normalizedRole === 'HUB' || normalizedRole === 'DESTINATION') {
      return this.repository.listAll(query.limit, query.nextToken);
    }

    if (normalizedRole === 'CONSUMER') {
      return this.repository.listByActor(ctx.actorId, query.limit, query.nextToken);
    }

    if (!ctx.organizationId) {
      throw new DomainError('Organization ID required', 'FORBIDDEN');
    }

    const orgDevices = await this.repository.listByOrganization(ctx.organizationId, query.limit, query.nextToken);
    const custodiedDevices = await this.repository.listByCustodian(ctx.organizationId, query.limit, query.nextToken);

    // Merge and deduplicate
    const combinedMap = new Map<string, Device>();
    orgDevices.items.forEach(d => combinedMap.set(d.deviceId, d));
    custodiedDevices.items.forEach(d => combinedMap.set(d.deviceId, d));

    return {
      items: Array.from(combinedMap.values()),
      nextToken: orgDevices.nextToken || custodiedDevices.nextToken // simplistic pagination merge
    };
  }

  async updateDevice(
    ctx: AuthorizationContext,
    deviceId: string,
    expectedVersion: number,
    input: DeviceUpdateInput
  ): Promise<Device> {
    requirePermission(ctx, 'device:update');

    const device = await this.getDevice(ctx, deviceId);

    // Check ownership
    if (device.registeredByOrganizationId !== ctx.organizationId) {
      throw new DomainError('Cannot update device from another organization', 'FORBIDDEN');
    }

    if (input.imei && !/^\d{15}$/.test(input.imei.trim())) {
      throw new DomainError('Invalid IMEI format', 'VALIDATION_ERROR');
    }

    const updates: Partial<Device> = {
      brand: input.brand,
      model: input.model,
      condition: input.condition,
      description: input.description,
      serialNumber: input.serialNumber?.trim().toUpperCase(),
      imei: input.imei?.trim(),
      assetTag: input.assetTag,
    };

    if (input.brand !== undefined || input.model !== undefined || input.condition !== undefined) {
      const newBrand = input.brand !== undefined ? input.brand : device.brand;
      const newModel = input.model !== undefined ? input.model : device.model;
      const newCond = input.condition !== undefined ? input.condition : device.condition;
      
      updates.indicativeValuation = this.valuationService.getValuation(newBrand, newModel, newCond, device.category);
    }

    const updatedDevice = await this.repository.update(deviceId, expectedVersion, updates);
    logger.info('Device updated', { deviceId, version: updatedDevice.version });
    return updatedDevice;
  }
}
