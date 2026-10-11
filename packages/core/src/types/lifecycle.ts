export type LifecycleState =
  | 'CREATED'
  | 'HANDED_OVER'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'ASSESSED'
  | 'ROUTED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'VERIFIED'
  | 'CLOSED';

export type DataSafetyState = 'USER_VERIFIED_RESET' | 'PARTNER_VERIFIED_WIPE' | 'NOT_VERIFIED';

export interface LifecycleTransition {
  from: LifecycleState;
  to: LifecycleState;
  actorRole: string[];
  requiredEvidenceTypes: string[];
}
