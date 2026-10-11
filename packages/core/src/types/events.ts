export type EventType =
  'CUSTODY_TRANSITION' | 'EVIDENCE_UPLOADED' | 'ANOMALY_DETECTED' | 'VERIFICATION_COMPLETED';

export interface DomainEventEnvelope<T> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  producer: string;
  correlationId: string;
  deviceId?: string;
  actorId?: string;
  payload: T;
}
