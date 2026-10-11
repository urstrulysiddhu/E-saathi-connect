import { EvidenceService } from '../src/domain/evidence-service';
import { EvidenceRepository } from '../src/infrastructure/repositories/evidence-repository';
import { DeviceRepository } from '../src/infrastructure/repositories/device-repository';
import { Device, Evidence, DomainError } from '@e-saathi/core';
import { AuthorizationContext } from '../src/domain/identity';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ContentLength: 5000, ContentType: 'image/jpeg' }),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.s3.url/'),
}));

class MockDeviceRepo extends DeviceRepository {
  public devices: Record<string, Device> = {};

  async getById(deviceId: string) {
    return this.devices[deviceId] || null;
  }
}

class MockEvidenceRepo extends EvidenceRepository {
  public records: Record<string, Evidence> = {};

  async saveEvidence(evidence: Evidence) {
    if (this.records[evidence.evidenceId]) {
      throw new DomainError('Evidence ID already exists', 'CONFLICT');
    }
    this.records[evidence.evidenceId] = evidence;
  }

  async getEvidence(evidenceId: string) {
    return this.records[evidenceId] || null;
  }

  async updateEvidenceStatus(
    evidenceId: string,
    status: Evidence['status'],
    updates: Partial<Evidence> = {}
  ) {
    if (!this.records[evidenceId]) throw new DomainError('Not found', 'NOT_FOUND');
    this.records[evidenceId].status = status;
    Object.assign(this.records[evidenceId], updates);
  }
}

describe('EvidenceService', () => {
  let evidenceRepo: MockEvidenceRepo;
  let deviceRepo: MockDeviceRepo;
  let service: EvidenceService;

  const mockCtx: AuthorizationContext = {
    subject: 'sub-1',
    userId: 'usr-1',
    actorId: 'act-1',
    organizationId: 'ORG-A',
    role: 'COLLECTOR',
    permissions: ['evidence:create', 'evidence:read', 'custody:verify'],
    actorStatus: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    requestId: 'req-1',
  };

  beforeEach(() => {
    evidenceRepo = new MockEvidenceRepo();
    deviceRepo = new MockDeviceRepo();
    service = new EvidenceService(
      evidenceRepo as unknown as EvidenceRepository,
      deviceRepo as unknown as DeviceRepository
    );

    deviceRepo.devices['dev-1'] = {
      deviceId: 'dev-1',
      category: 'MOBILE_PHONE',
      condition: 'WORKING',
      registeredByActorId: 'act-1',
      registeredByOrganizationId: 'ORG-A',
      lifecycleState: 'CREATED',
      dataSafetyState: 'NOT_VERIFIED',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
  });

  it('generates upload intent successfully', async () => {
    const result = await service.generateUploadIntent(mockCtx, {
      deviceId: 'dev-1',
      evidenceType: 'HANDOVER_PHOTO',
      contentType: 'image/jpeg',
      fileSizeBytes: 5000,
    });

    expect(result.evidenceId).toBeDefined();
    expect(result.presignedUrl).toBe('https://presigned.s3.url/');
    expect(evidenceRepo.records[result.evidenceId].status).toBe('PENDING_UPLOAD');
    expect(evidenceRepo.records[result.evidenceId].capturedByOrganizationId).toBe('ORG-A');
  });

  it('rejects oversized file', async () => {
    await expect(
      service.generateUploadIntent(mockCtx, {
        deviceId: 'dev-1',
        evidenceType: 'HANDOVER_PHOTO',
        contentType: 'image/jpeg',
        fileSizeBytes: 15 * 1024 * 1024,
      })
    ).rejects.toThrow('File size exceeds the 10MB limit');
  });

  it('completes upload securely', async () => {
    const intent = await service.generateUploadIntent(mockCtx, {
      deviceId: 'dev-1',
      evidenceType: 'HANDOVER_PHOTO',
      contentType: 'image/jpeg',
      fileSizeBytes: 5000,
    });

    const result = await service.completeUpload(mockCtx, intent.evidenceId);
    expect(result.status).toBe('UPLOADED');
  });

  it('prevents cross-org access', async () => {
    const intent = await service.generateUploadIntent(mockCtx, {
      deviceId: 'dev-1',
      evidenceType: 'HANDOVER_PHOTO',
      contentType: 'image/jpeg',
      fileSizeBytes: 5000,
    });

    const badCtx = { ...mockCtx, organizationId: 'ORG-B' };

    await expect(service.getEvidenceMetadata(badCtx, intent.evidenceId)).rejects.toThrow(
      'Unauthorized access to evidence record'
    );
  });
  it('allows CONSUMER to generate upload intent without organizationId', async () => {
    const consumerCtx: AuthorizationContext = {
      subject: 'sub-2',
      userId: 'usr-2',
      actorId: 'act-1',
      role: 'CONSUMER',
      permissions: ['evidence:create'],
      actorStatus: 'ACTIVE',
      membershipStatus: 'ACTIVE',
      requestId: 'req-2',
    };

    const result = await service.generateUploadIntent(consumerCtx, {
      deviceId: 'dev-1',
      evidenceType: 'DEVICE_PHOTO',
      contentType: 'image/jpeg',
      fileSizeBytes: 5000,
    });

    expect(result.evidenceId).toBeDefined();
    expect(result.objectKey).toContain('act-1');
  });
});
