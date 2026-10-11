import { LocationEvidence } from './custody';

export type EvidenceType =
  | 'DEVICE_PHOTO'
  | 'IDENTIFIER_PHOTO'
  | 'HANDOVER_PHOTO'
  | 'RECEIPT_PHOTO'
  | 'ASSESSMENT_PHOTO'
  | 'PROCESSING_PHOTO'
  | 'VERIFICATION_DOCUMENT'
  | 'WIPE_VERIFICATION'
  | 'OTHER';

export type EvidenceStatus =
  'PENDING_UPLOAD' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'QUARANTINED';

export interface Evidence {
  evidenceId: string;
  deviceId: string;
  evidenceType: EvidenceType;
  status: EvidenceStatus;
  objectKey: string;
  contentType: string;
  fileSizeBytes: number;
  sha256?: string;
  capturedAt: string;
  uploadedAt?: string;
  capturedByActorId: string;
  capturedByOrganizationId?: string;
  source: string;
  locationEvidence?: LocationEvidence;
  metadata?: Record<string, unknown>;
  createdAt: string;
  custodyEventId?: string;
}

export interface UploadIntentInput {
  deviceId: string;
  evidenceType: EvidenceType;
  contentType: string;
  fileSizeBytes: number;
  custodyEventId?: string;
  metadata?: Record<string, unknown>;
  locationEvidence?: LocationEvidence;
}

export interface UploadIntentResponse {
  evidenceId: string;
  objectKey: string;
  presignedUrl: string;
  expiration: string;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  evidenceId: string;
  checkedAt: string;
  sha256?: string;
  reason?: string;
}

export interface VisualContinuitySignal {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
  confidence: number;
  reason: string;
}
