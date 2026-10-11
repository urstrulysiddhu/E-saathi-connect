import { RoutingRepository } from '../infrastructure/repositories/routing-repository';
import { DestinationRepository } from '../infrastructure/repositories/destination-repository';
import { NetworkRepository } from '../infrastructure/repositories/network-repository';
import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import { RoutingEligibilityService } from './routing-eligibility-service';
import { RoutingDecision, Destination, NetworkRelationship, DomainError } from '@e-saathi/core';
import { AuthorizationContext } from './identity';
import { v4 as uuidv4 } from 'uuid';

export class RoutingService {
  constructor(
    private routingRepo: RoutingRepository,
    private destRepo: DestinationRepository,
    private networkRepo: NetworkRepository,
    private commercialRepo: CommercialRepository,
    private deviceRepo: DeviceRepository,
    private eligibilityService: RoutingEligibilityService
  ) {}

  async createDestination(
    ctx: AuthorizationContext,
    input: Omit<Destination, 'destinationId' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Destination> {
    if (!ctx.organizationId) throw new DomainError('Organization context required', 'FORBIDDEN');
    if (
      !ctx.permissions.includes('destination:create') &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Unauthorized to create destination', 'FORBIDDEN');
    }

    if (input.organizationId !== ctx.organizationId && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Cannot create destination for another organization', 'FORBIDDEN');
    }

    const dest: Destination = {
      ...input,
      destinationId: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await this.destRepo.save(dest);
    return dest;
  }

  async getDestination(ctx: AuthorizationContext, destinationId: string): Promise<Destination> {
    const dest = await this.destRepo.getById(destinationId);
    if (!dest) throw new DomainError('Destination not found', 'NOT_FOUND');

    if (!ctx.permissions.includes('destination:read') && !ctx.permissions.includes('admin:read')) {
      throw new DomainError('Unauthorized to read destination', 'FORBIDDEN');
    }

    return dest;
  }

  async createNetworkRelationship(
    ctx: AuthorizationContext,
    input: Omit<NetworkRelationship, 'relationshipId' | 'createdAt' | 'updatedAt'>
  ): Promise<NetworkRelationship> {
    if (!ctx.organizationId) throw new DomainError('Organization context required', 'FORBIDDEN');
    if (!ctx.permissions.includes('network:manage') && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Unauthorized to create network relationship', 'FORBIDDEN');
    }

    // Must be one of the parties
    if (
      input.fromOrganizationId !== ctx.organizationId &&
      input.toOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Cannot create relationship for other organizations', 'FORBIDDEN');
    }

    const rel: NetworkRelationship = {
      ...input,
      relationshipId: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.networkRepo.save(rel);
    return rel;
  }

  async getRoutingOptions(ctx: AuthorizationContext, deviceId: string) {
    if (!ctx.organizationId) throw new DomainError('Organization context required', 'FORBIDDEN');
    if (!ctx.permissions.includes('routing:read') && !ctx.permissions.includes('admin:read')) {
      throw new DomainError('Unauthorized to read routing options', 'FORBIDDEN');
    }

    const device = await this.deviceRepo.getById(deviceId);
    if (!device) throw new DomainError('Device not found', 'NOT_FOUND');

    // Cross-org check for device
    if (
      device.registeredByOrganizationId !== ctx.organizationId &&
      device.currentCustodianOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:read')
    ) {
      throw new DomainError('Unauthorized to access device routing', 'FORBIDDEN');
    }

    const destinations = await this.destRepo.listActive();
    const relationships = await this.networkRepo.listByOrganization(ctx.organizationId);

    // For MVP, find applicable offers by category/condition
    const candidateOffers = await this.commercialRepo.findApplicableOffers(device.category);

    return this.eligibilityService.evaluate(
      device,
      destinations,
      relationships,
      candidateOffers,
      ctx
    );
  }

  async createRoutingDecision(
    ctx: AuthorizationContext,
    input: { deviceId: string; selectedDestinationId: string }
  ): Promise<RoutingDecision> {
    if (!ctx.organizationId) throw new DomainError('Organization context required', 'FORBIDDEN');
    if (!ctx.permissions.includes('routing:create') && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Unauthorized to create routing decision', 'FORBIDDEN');
    }

    const options = await this.getRoutingOptions(ctx, input.deviceId);

    const selectedOption = options.results.find(
      (r) => r.destinationId === input.selectedDestinationId
    );
    if (!selectedOption) {
      throw new DomainError('Destination not found in candidate list', 'NOT_FOUND');
    }

    if (!selectedOption.eligible) {
      throw new DomainError('Destination is not eligible for routing', 'VALIDATION_ERROR');
    }

    // Find the destination to match by organizationId
    const destination = await this.destRepo.getById(input.selectedDestinationId);
    const destinationOrgId = destination?.organizationId || input.selectedDestinationId;

    // Find the relationship
    const relationships = await this.networkRepo.listByOrganization(ctx.organizationId);
    const relationship = relationships.find(
      (r) => r.toOrganizationId === destinationOrgId
    );

    const decision: RoutingDecision = {
      routingDecisionId: uuidv4(),
      deviceId: input.deviceId,
      sourceOrganizationId: ctx.organizationId,
      sourceActorId: ctx.actorId,
      selectedDestinationId: input.selectedDestinationId,
      selectedRelationshipId: relationship?.relationshipId || 'NONE',
      eligibilitySnapshot: {
        reasons: selectedOption.reasons,
        evaluatedAt: new Date().toISOString(),
      },
      decisionReason: 'USER_SELECTED',
      decisionStatus: 'PROPOSED',
      createdAt: new Date().toISOString(),
      createdByActorId: ctx.actorId,
      version: 1,
    };

    await this.routingRepo.save(decision);
    return decision;
  }
}
