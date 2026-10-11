import { LifecycleState } from './lifecycle';

export type CustodyEventType =
  | 'DEVICE_REGISTERED'
  | 'HANDOVER_INITIATED'
  | 'HANDOVER_ACCEPTED'
  | 'COLLECTION_CONFIRMED'
  | 'HUB_RECEIPT_CONFIRMED'
  | 'ASSESSMENT_RECORDED'
  | 'ROUTING_CONFIRMED'
  | 'PROCESSING_STARTED'
  | 'PROCESSING_COMPLETED'
  | 'VERIFICATION_COMPLETED'
  | 'CLOSURE_CONFIRMED';

export type LocationSource = 'GPS' | 'MANUAL' | 'SIMULATED' | 'UNAVAILABLE';

export interface LocationEvidence {
  locationSource: LocationSource;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  capturedAt?: string;
}

export interface EvidenceReference {
  evidenceId: string;
  evidenceType: string;
}

export interface CustodyEvent {
  eventId: string;
  deviceId: string;
  eventType: CustodyEventType;
  fromActorId?: string;
  toActorId?: string;
  fromOrganizationId?: string;
  toOrganizationId?: string;
  previousLifecycleState: LifecycleState;
  newLifecycleState: LifecycleState;
  occurredAt: string;
  recordedAt: string;
  recordedByActorId: string;
  recordedByOrganizationId: string;
  locationEvidence?: LocationEvidence;
  evidenceReferences?: EvidenceReference[];
  previousEventHash: string | null;
  eventPayloadHash: string;
  eventHash: string;
  idempotencyKey?: string;
  authorizationContext?: unknown; // omitted from hash typically, but useful for audit
  metadata?: Record<string, unknown>;
}

export interface CustodyTransitionInput {
  eventType: CustodyEventType;
  expectedVersion: number;
  idempotencyKey: string;
  evidenceReferences?: EvidenceReference[];
  locationEvidence?: LocationEvidence;
  metadata?: Record<string, unknown>;
}

export interface CustodyChainVerificationResult {
  valid: boolean;
  deviceId: string;
  eventsChecked: number;
  firstInvalidEventId: string | null;
}
