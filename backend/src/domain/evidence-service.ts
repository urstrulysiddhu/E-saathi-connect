import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { EvidenceRepository } from '../infrastructure/repositories/evidence-repository';
import { DeviceRepository } from '../infrastructure/repositories/device-repository';
import {
  Evidence,
  UploadIntentInput,
  UploadIntentResponse,
  DomainError,
  EvidenceVerificationResult,
} from '@e-saathi/core';
import { AuthorizationContext } from './identity';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export class EvidenceService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private evidenceRepo: EvidenceRepository,
    private deviceRepo: DeviceRepository
  ) {
    this.s3Client = new S3Client({});
    this.bucketName = process.env.BUCKET_NAME || '';
  }

  async generateUploadIntent(
    ctx: AuthorizationContext,
    input: UploadIntentInput
  ): Promise<UploadIntentResponse> {
    if (!ALLOWED_MIME_TYPES.includes(input.contentType)) {
      throw new DomainError(`Unsupported content type: ${input.contentType}`, 'VALIDATION_ERROR');
    }
    if (input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new DomainError('File size exceeds the 10MB limit', 'VALIDATION_ERROR');
    }

    const device = await this.deviceRepo.getById(input.deviceId);
    if (!device) {
      throw new DomainError('Device not found', 'NOT_FOUND');
    }

    // Is the user authorized to act on this device?
    // A simplified boundary constraint: the actor must belong to an organization that is involved.
    // In a full implementation, we verify explicit device custodianship or creation context.
    if (!ctx.permissions.includes('evidence:create')) {
      throw new DomainError('Not authorized to upload evidence', 'FORBIDDEN');
    }

    if (!ctx.organizationId && ctx.role !== 'CONSUMER') {
      throw new DomainError('Organization context required to upload evidence', 'FORBIDDEN');
    }

    if (ctx.role === 'CONSUMER' && device.registeredByActorId !== ctx.actorId && device.currentCustodianActorId !== ctx.actorId) {
      throw new DomainError('Consumers can only upload evidence for their own devices', 'FORBIDDEN');
    }

    const evidenceId = uuidv4();
    const extension =
      input.contentType.split('/')[1] === 'pdf' ? 'pdf' : input.contentType.split('/')[1];
    const folderPrefix = ctx.organizationId || ctx.actorId;
    const objectKey = `evidence/${folderPrefix}/${input.deviceId}/${evidenceId}.${extension}`;

    const evidenceRecord: Evidence = {
      evidenceId,
      deviceId: input.deviceId,
      evidenceType: input.evidenceType,
      status: 'PENDING_UPLOAD',
      objectKey,
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
      capturedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      capturedByActorId: ctx.actorId,
      capturedByOrganizationId: ctx.organizationId,
      source: 'DIRECT_UPLOAD',
      custodyEventId: input.custodyEventId,
      metadata: input.metadata,
      locationEvidence: input.locationEvidence,
    };

    await this.evidenceRepo.saveEvidence(evidenceRecord);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: input.contentType,
    });

    // 15 minutes expiration
    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    return {
      evidenceId,
      objectKey,
      presignedUrl,
      expiration: new Date(Date.now() + 900 * 1000).toISOString(),
    };
  }

  async completeUpload(ctx: AuthorizationContext, evidenceId: string): Promise<Evidence> {
    const evidence = await this.evidenceRepo.getEvidence(evidenceId);
    if (!evidence) {
      throw new DomainError('Evidence record not found', 'NOT_FOUND');
    }

    // Verify ownership
    if (ctx.role === 'CONSUMER') {
      if (evidence.capturedByActorId !== ctx.actorId) {
        throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
      }
    } else if (
      evidence.capturedByOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:read')
    ) {
      throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
    }

    if (evidence.status !== 'PENDING_UPLOAD') {
      throw new DomainError('Evidence is not pending upload', 'VALIDATION_ERROR');
    }

    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: evidence.objectKey,
        })
      );

      if (
        head.ContentLength !== evidence.fileSizeBytes ||
        head.ContentType !== evidence.contentType
      ) {
        throw new DomainError('Uploaded object metadata mismatch', 'VALIDATION_ERROR');
      }

      const uploadedAt = new Date().toISOString();
      await this.evidenceRepo.updateEvidenceStatus(evidenceId, 'UPLOADED', { uploadedAt });

      return { ...evidence, status: 'UPLOADED', uploadedAt };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
        throw new DomainError('S3 object not found', 'NOT_FOUND');
      }
      throw error;
    }
  }

  async getEvidenceMetadata(ctx: AuthorizationContext, evidenceId: string): Promise<Evidence> {
    const evidence = await this.evidenceRepo.getEvidence(evidenceId);
    if (!evidence) {
      throw new DomainError('Evidence not found', 'NOT_FOUND');
    }

    const device = await this.deviceRepo.getById(evidence.deviceId);
    if (!device) {
      throw new DomainError('Associated device not found', 'NOT_FOUND');
    }

    const normalizedRole = ctx.role?.toUpperCase();

    // 1. Admin has global audit and verification access
    if (normalizedRole === 'ADMIN' || ctx.permissions.includes('admin:read') || ctx.permissions.includes('admin:manage')) {
      return evidence;
    }

    // 2. Consumer can view evidence for devices they registered
    if (normalizedRole === 'CONSUMER') {
      if (evidence.capturedByActorId !== ctx.actorId && device.registeredByActorId !== ctx.actorId) {
        throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
      }
      return evidence;
    }

    // 3. Organization actors (Collector, Hub, Destination)
    if (!ctx.permissions.includes('evidence:read')) {
      throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
    }

    const isCapturer = Boolean(ctx.organizationId && evidence.capturedByOrganizationId === ctx.organizationId);
    const isCustodian = Boolean(ctx.organizationId && device.currentCustodianOrganizationId === ctx.organizationId);

    if (evidence.capturedByOrganizationId) {
      if (!isCapturer && !isCustodian) {
        throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
      }
    } else {
      if (!isCustodian && device.registeredByOrganizationId && device.registeredByOrganizationId !== ctx.organizationId) {
        throw new DomainError('Unauthorized access to evidence record', 'FORBIDDEN');
      }
    }

    return evidence;
  }

  async generateAccessUrl(ctx: AuthorizationContext, evidenceId: string): Promise<string> {
    const evidence = await this.getEvidenceMetadata(ctx, evidenceId);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: evidence.objectKey,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 }); // 5 minutes
  }

  async verifyEvidence(
    ctx: AuthorizationContext,
    evidenceId: string
  ): Promise<EvidenceVerificationResult> {
    const evidence = await this.getEvidenceMetadata(ctx, evidenceId);

    if (!ctx.permissions.includes('custody:verify') && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Not authorized to verify evidence', 'FORBIDDEN');
    }

    try {
      const getObject = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: evidence.objectKey,
        })
      );

      if (!getObject.Body) {
        return {
          valid: false,
          evidenceId,
          checkedAt: new Date().toISOString(),
          reason: 'Empty object body',
        };
      }

      // Hash stream
      const stream = getObject.Body as NodeJS.ReadableStream;
      const hash = crypto.createHash('sha256');

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const sha256 = hash.digest('hex');

      await this.evidenceRepo.updateEvidenceStatus(evidenceId, 'VERIFIED', { sha256 });

      return {
        valid: true,
        evidenceId,
        checkedAt: new Date().toISOString(),
        sha256,
      };
    } catch {
      return {
        valid: false,
        evidenceId,
        checkedAt: new Date().toISOString(),
        reason: 'Failed to retrieve or hash S3 object',
      };
    }
  }

  async listEvidenceForDevice(ctx: AuthorizationContext, deviceId: string): Promise<{ items: Evidence[] }> {
    const device = await this.deviceRepo.getById(deviceId);
    if (!device) throw new DomainError('Device not found', 'NOT_FOUND');
    
    // We enforce that users with basic read permission or the registering consumer can list.
    if (
      !ctx.permissions.includes('evidence:read') &&
      !(ctx.role === 'CONSUMER' && device.registeredByActorId === ctx.actorId)
    ) {
      throw new DomainError('Not authorized to read evidence', 'FORBIDDEN');
    }

    const items = await this.evidenceRepo.listByDevice(deviceId);
    return { items };
  }
}
