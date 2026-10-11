import { RoutingService } from '../src/domain/routing-service';
import { RoutingEligibilityService } from '../src/domain/routing-eligibility-service';
import { AuthorizationContext } from '../src/domain/identity';
import { DestinationRepository } from '../src/infrastructure/repositories/destination-repository';
import { NetworkRepository } from '../src/infrastructure/repositories/network-repository';
import { CommercialRepository } from '../src/infrastructure/repositories/commercial-repository';
import { DeviceRepository } from '../src/infrastructure/repositories/device-repository';
import { RoutingRepository } from '../src/infrastructure/repositories/routing-repository';

describe('RoutingService', () => {
  let routingService: RoutingService;
  let destRepo: jest.Mocked<DestinationRepository>;
  let networkRepo: jest.Mocked<NetworkRepository>;
  let commRepo: jest.Mocked<CommercialRepository>;
  let deviceRepo: jest.Mocked<DeviceRepository>;
  let routingRepo: jest.Mocked<RoutingRepository>;
  let eligService: RoutingEligibilityService;

  beforeEach(() => {
    destRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      listActive: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<DestinationRepository>;
    networkRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      listByOrganization: jest.fn(),
    } as jest.Mocked<NetworkRepository>;
    commRepo = {
      saveTerms: jest.fn(),
      saveOffer: jest.fn(),
      getOffer: jest.fn(),
      findApplicableOffers: jest.fn(),
      saveTransaction: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionsByDevice: jest.fn(),
      listTransactionsByDestination: jest.fn(),
      saveSettlement: jest.fn(),
      getSettlement: jest.fn(),
    } as unknown as jest.Mocked<CommercialRepository>;
    deviceRepo = {
      create: jest.fn(),
      getById: jest.fn(),
      listByOrganization: jest.fn(),
      listByActor: jest.fn(),
      listAll: jest.fn(),
      update: jest.fn(),
      checkIdempotency: jest.fn(),
      saveIdempotency: jest.fn(),
      listByCustodian: jest.fn(),
    } as unknown as jest.Mocked<DeviceRepository>;
    routingRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      listByDevice: jest.fn(),
      updateStatus: jest.fn(),
    } as jest.Mocked<RoutingRepository>;
    eligService = new RoutingEligibilityService();
    routingService = new RoutingService(
      routingRepo,
      destRepo,
      networkRepo,
      commRepo,
      deviceRepo,
      eligService
    );
  });

  const ctx: AuthorizationContext = {
    subject: 'sub-1',
    userId: 'user-1',
    actorId: 'act-1',
    organizationId: 'ORG-A',
    role: 'COLLECTOR',
    permissions: ['routing:read', 'routing:create', 'destination:read', 'destination:create'],
    actorStatus: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    requestId: 'req-1',
  };

  it('creates destination if authorized', async () => {
    destRepo.save.mockResolvedValue(undefined);
    const dest = await routingService.createDestination(ctx, {
      organizationId: 'ORG-A',
      name: 'Dest A',
      destinationType: 'RECYCLER',
      authorizationStatus: 'ACTIVE',
      authorizationReference: 'REF',
      authorizationValidFrom: '2020-01-01',
      authorizationValidUntil: '2030-01-01',
      operationalStatus: 'OPERATIONAL',
      acceptedDeviceCategories: ['MOBILE'],
      acceptedConditions: ['WORKING'],
      capabilities: ['DATA_WIPE'],
      serviceAreas: ['AREA1'],
    });
    expect(dest.destinationId).toBeDefined();
    expect(dest.organizationId).toBe('ORG-A');
  });

  it('blocks destination creation for other orgs', async () => {
    await expect(
      routingService.createDestination(ctx, {
        organizationId: 'ORG-B',
        name: 'Dest B',
        destinationType: 'RECYCLER',
        authorizationStatus: 'ACTIVE',
        authorizationReference: 'REF',
        authorizationValidFrom: '2020-01-01',
        authorizationValidUntil: '2030-01-01',
        operationalStatus: 'OPERATIONAL',
        acceptedDeviceCategories: ['MOBILE_PHONE'],
        acceptedConditions: ['WORKING'],
        capabilities: ['DATA_WIPE'],
        serviceAreas: ['AREA1'],
      })
    ).rejects.toThrow('Cannot create destination for another organization');
  });

  it('evaluates routing eligibility accurately', async () => {
    deviceRepo.getById.mockResolvedValue({
      deviceId: 'dev-1',
      category: 'MOBILE_PHONE',
      condition: 'WORKING',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      version: 1,
      lifecycleState: 'CREATED',
      dataSafetyState: 'NOT_VERIFIED',
      registeredByActorId: 'user1',
      registeredByOrganizationId: 'ORG-A',
      currentCustodianOrganizationId: 'ORG-A',
    });
    destRepo.listActive.mockResolvedValue([
      {
        destinationId: 'dest-1',
        organizationId: 'ORG-DEST',
        name: 'Dest 1',
        destinationType: 'RECYCLER',
        authorizationReference: 'REF',
        authorizationValidFrom: '2020-01-01T00:00:00.000Z',
        capabilities: [],
        serviceAreas: [],
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        version: 1,
        operationalStatus: 'OPERATIONAL',
        authorizationStatus: 'ACTIVE',
        authorizationValidUntil: '2030-01-01T00:00:00.000Z',
        acceptedDeviceCategories: ['MOBILE_PHONE'],
        acceptedConditions: ['WORKING'],
      },
      {
        destinationId: 'dest-2', // Should fail relationship
        organizationId: 'ORG-DEST-NO-REL',
        name: 'Dest 2',
        destinationType: 'RECYCLER',
        authorizationReference: 'REF',
        authorizationValidFrom: '2020-01-01T00:00:00.000Z',
        capabilities: [],
        serviceAreas: [],
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        version: 1,
        operationalStatus: 'OPERATIONAL',
        authorizationStatus: 'ACTIVE',
        authorizationValidUntil: '2030-01-01T00:00:00.000Z',
        acceptedDeviceCategories: ['MOBILE_PHONE'],
        acceptedConditions: ['WORKING'],
      },
    ]);
    networkRepo.listByOrganization.mockResolvedValue([
      {
        relationshipId: 'rel-1',
        fromOrganizationId: 'ORG-A',
        toOrganizationId: 'ORG-DEST',
        relationshipType: 'NETWORK_PARTNER',
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        effectiveUntil: '2030-01-01T00:00:00.000Z',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
    ]);
    commRepo.findApplicableOffers.mockResolvedValue([]);

    const options = await routingService.getRoutingOptions(ctx, 'dev-1');
    expect(options.results).toHaveLength(2);

    const validDest = options.results.find((r) => r.destinationId === 'dest-1');
    expect(validDest?.eligible).toBe(true);

    const invalidDest = options.results.find((r) => r.destinationId === 'dest-2');
    expect(invalidDest?.eligible).toBe(false);
    expect(invalidDest?.failedRules).toContain('NO_ACTIVE_NETWORK_RELATIONSHIP');
  });
});
