import { CustodyRepository } from '../infrastructure/repositories/custody-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { AuthorizationContext } from './identity';
import { validateTransition } from './custody-policy';
import { requirePermission } from '../shared/authorization';
import * as crypto from 'crypto';
import { logger } from '../shared/logger';
import {
  Device,
  CustodyEvent,
  CustodyTransitionInput,
  CustodyChainVerificationResult,
  DomainError,
} from '@e-saathi/core';

export class CustodyService {
  constructor(
    private readonly custodyRepo: CustodyRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly commercialRepo: CommercialRepository
  ) {}

  private hashEvent(
    payload: Record<string, unknown>,
    previousHash: string | null
  ): { payloadHash: string; eventHash: string } {
    // Canonical serialization: alphabetize keys and omit undefined/nulls
    const canonical = JSON.stringify(payload, Object.keys(payload).sort(), 0);
    const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');
    const combined = previousHash ? `${previousHash}:${payloadHash}` : payloadHash;
    const eventHash = crypto.createHash('sha256').update(combined).digest('hex');
    return { payloadHash, eventHash };
  }

  async transitionCustody(
    ctx: AuthorizationContext,
    deviceId: string,
    input: CustodyTransitionInput
  ): Promise<{ device: Device; custodyEvent: CustodyEvent; version: number }> {
    if (ctx.role === 'CONSUMER') {
      requirePermission(ctx, 'device:update');
    } else if (ctx.role === 'ADMIN') {
      requirePermission(ctx, 'custody:verify');
      if (!ctx.organizationId) {
        ctx.organizationId = 'ADMIN_ORG';
      }
    } else {
      requirePermission(ctx, 'custody:route'); // Using a general custody permission
      if (!ctx.organizationId) {
        throw new DomainError('Organization ID is required for custody transitions', 'FORBIDDEN');
      }
    }

    // 1. Idempotency Check First
    const existingIdem = await this.custodyRepo.checkIdempotency(
      input.idempotencyKey,
      ctx.role === 'CONSUMER' ? ctx.actorId : ctx.organizationId!
    );
    if (existingIdem) {
      if (existingIdem.deviceId !== deviceId) {
        throw new DomainError('Idempotency key already used for a different device', 'CONFLICT');
      }

      const latestEvent = await this.custodyRepo.getLatestEvent(deviceId);
      const currentDevice = await this.deviceRepo.getById(deviceId);

      if (!latestEvent || !currentDevice) {
        throw new DomainError(
          'Inconsistent state: Idempotency record exists but event/device missing',
          'CONFLICT'
        );
      }

      if (latestEvent.eventId === existingIdem.eventId) {
        logger.info('Returning idempotent custody response', {
          deviceId,
          eventId: latestEvent.eventId,
        });
        return {
          device: currentDevice,
          custodyEvent: latestEvent,
          version: currentDevice.version,
        };
      } else {
        throw new DomainError(
          'Idempotency conflict: key was used but does not match latest event',
          'CONFLICT'
        );
      }
    }

    // 2. Fetch Device
    const device = await this.deviceRepo.getById(deviceId);
    if (!device) {
      throw new DomainError('Device not found', 'NOT_FOUND');
    }

    // 3. Evaluate Authorization & Transition Logic
    const isCurrentCustodian =
      device.currentCustodianOrganizationId === ctx.organizationId ||
      (device.lifecycleState === 'CREATED' &&
        device.registeredByOrganizationId === ctx.organizationId);

    const rule = validateTransition(
      device.lifecycleState,
      input.eventType,
      ctx.role,
      isCurrentCustodian
    );

    // Set new custodians based on logic
    let newCustodianActorId = device.currentCustodianActorId;
    let newCustodianOrgId = device.currentCustodianOrganizationId;

    if (input.eventType === 'HANDOVER_ACCEPTED' || input.eventType === 'COLLECTION_CONFIRMED' || input.eventType === 'HUB_RECEIPT_CONFIRMED' || input.eventType === 'PROCESSING_STARTED') {
      newCustodianActorId = ctx.actorId;
      newCustodianOrgId = ctx.organizationId;
    }

    // SERVER-SIDE TRANSFER GATING
    // If custody is moving between two DIFFERENT organizations, require an ACCEPTED or SETTLED commercial agreement
    const currentCustodianOrgId = device.currentCustodianOrganizationId || device.registeredByOrganizationId;
    if (
      newCustodianOrgId && 
      currentCustodianOrgId && 
      newCustodianOrgId !== currentCustodianOrgId &&
      // Consumers don't require commercial agreements for the initial handover,
      // nor does operational intake of collected hardware from local collectors to hub
      rule.from !== 'CREATED' &&
      rule.from !== 'HANDED_OVER' &&
      rule.from !== 'COLLECTED'
    ) {
      const txs = await this.commercialRepo.getTransactionsByDevice(deviceId);
      
      const validTx = txs.find(tx => 
        tx.sourceOrganizationId === currentCustodianOrgId &&
        tx.destinationOrganizationId === newCustodianOrgId &&
        (tx.transactionStatus === 'ACCEPTED' || tx.transactionStatus === 'SETTLED' || tx.transactionStatus === 'COMPLETED')
      );
      
      if (!validTx) {
        throw new DomainError(
          'A commercial agreement must be ACCEPTED or SETTLED before cross-organization transfer.',
          'FORBIDDEN'
        );
      }
    }

    // 4. Create Custody Event Payload
    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();

    const latestEvent = await this.custodyRepo.getLatestEvent(deviceId);
    const previousEventHash = latestEvent ? latestEvent.eventHash : null;

    const payloadToHash = {
      deviceId,
      eventType: input.eventType,
      fromActorId: device.currentCustodianActorId || device.registeredByActorId,
      toActorId: newCustodianActorId,
      fromOrganizationId:
        device.currentCustodianOrganizationId || device.registeredByOrganizationId,
      toOrganizationId: newCustodianOrgId,
      previousLifecycleState: device.lifecycleState,
      newLifecycleState: rule.to,
      occurredAt: now,
      evidenceReferences: input.evidenceReferences || [],
      locationEvidence: input.locationEvidence,
      metadata: input.metadata || {},
    };

    const { payloadHash, eventHash } = this.hashEvent(payloadToHash, previousEventHash);

    const custodyEvent: CustodyEvent = {
      eventId,
      ...payloadToHash,
      recordedAt: now,
      recordedByActorId: ctx.actorId,
      recordedByOrganizationId: ctx.role === 'CONSUMER' ? ctx.actorId : ctx.organizationId!,
      previousEventHash,
      eventPayloadHash: payloadHash,
      eventHash,
      idempotencyKey: input.idempotencyKey,
    };

    // Update Device State memory object
    device.lifecycleState = rule.to;
    device.currentCustodianActorId = newCustodianActorId;
    device.currentCustodianOrganizationId = newCustodianOrgId;
    // Note: the repository transaction applies version incrementing

    // 5. Atomic Transaction
    await this.custodyRepo.appendEvent(device, custodyEvent, input.expectedVersion);

    logger.info('Custody transition successful', {
      deviceId,
      eventId,
      fromState: payloadToHash.previousLifecycleState,
      toState: payloadToHash.newLifecycleState,
      actorId: ctx.actorId,
    });

    return {
      device: { ...device, version: input.expectedVersion + 1 },
      custodyEvent,
      version: input.expectedVersion + 1,
    };
  }

  async getDeviceTimeline(ctx: AuthorizationContext, deviceId: string): Promise<CustodyEvent[]> {
    requirePermission(ctx, 'device:read');

    // Authorization logic to ensure organization can see device (from phase 3 logic)
    const device = await this.deviceRepo.getById(deviceId);
    if (!device) throw new DomainError('Device not found', 'NOT_FOUND');

    if (
      ctx.role !== 'ADMIN' &&
      device.registeredByOrganizationId !== ctx.organizationId &&
      device.currentCustodianOrganizationId !== ctx.organizationId
    ) {
      throw new DomainError('Device not found', 'NOT_FOUND');
    }

    return this.custodyRepo.getDeviceTimeline(deviceId);
  }

  async getLatestEvent(ctx: AuthorizationContext, deviceId: string): Promise<CustodyEvent | null> {
    requirePermission(ctx, 'device:read');
    return this.custodyRepo.getLatestEvent(deviceId);
  }

  async verifyDeviceCustodyChain(
    ctx: AuthorizationContext,
    deviceId: string
  ): Promise<CustodyChainVerificationResult> {
    requirePermission(ctx, 'device:read');

    const events = await this.custodyRepo.getDeviceTimeline(deviceId);
    let currentHash: string | null = null;
    let eventsChecked = 0;

    for (const event of events) {
      eventsChecked++;

      // Check linkage
      if (event.previousEventHash !== currentHash) {
        return {
          valid: false,
          deviceId,
          eventsChecked,
          firstInvalidEventId: event.eventId,
        };
      }

      // Recreate payload to verify payload hash
      const payloadToHash = {
        deviceId: event.deviceId,
        eventType: event.eventType,
        fromActorId: event.fromActorId,
        toActorId: event.toActorId,
        fromOrganizationId: event.fromOrganizationId,
        toOrganizationId: event.toOrganizationId,
        previousLifecycleState: event.previousLifecycleState,
        newLifecycleState: event.newLifecycleState,
        occurredAt: event.occurredAt,
        evidenceReferences: event.evidenceReferences || [],
        locationEvidence: event.locationEvidence,
        metadata: event.metadata || {},
      };

      const { payloadHash, eventHash } = this.hashEvent(payloadToHash, currentHash);

      if (event.eventPayloadHash !== payloadHash || event.eventHash !== eventHash) {
        return {
          valid: false,
          deviceId,
          eventsChecked,
          firstInvalidEventId: event.eventId,
        };
      }

      currentHash = event.eventHash;
    }

    return {
      valid: true,
      deviceId,
      eventsChecked,
      firstInvalidEventId: null,
    };
  }
}
