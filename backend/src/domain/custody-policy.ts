import { LifecycleState, CustodyEventType, ActorRole, DomainError } from '@e-saathi/core';

export interface TransitionRule {
  from: LifecycleState;
  to: LifecycleState;
  eventType: CustodyEventType;
  allowedRoles: ActorRole[];
  requiresCurrentCustodianAuth: boolean;
}

export const TransitionMatrix: TransitionRule[] = [
  {
    from: 'CREATED',
    to: 'HANDED_OVER',
    eventType: 'HANDOVER_INITIATED',
    allowedRoles: ['CONSUMER'], // or whoever is authorized
    requiresCurrentCustodianAuth: true, // the one who registered it
  },
  {
    from: 'CREATED',
    to: 'COLLECTED',
    eventType: 'HANDOVER_ACCEPTED',
    allowedRoles: ['COLLECTOR'],
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'CREATED',
    to: 'COLLECTED',
    eventType: 'COLLECTION_CONFIRMED',
    allowedRoles: ['COLLECTOR'],
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'HANDED_OVER',
    to: 'COLLECTED',
    eventType: 'HANDOVER_ACCEPTED',
    allowedRoles: ['COLLECTOR'],
    requiresCurrentCustodianAuth: false, // Collector is accepting it from the consumer
  },
  {
    from: 'HANDED_OVER',
    to: 'COLLECTED',
    eventType: 'COLLECTION_CONFIRMED',
    allowedRoles: ['COLLECTOR'],
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'COLLECTED',
    to: 'RECEIVED',
    eventType: 'HUB_RECEIPT_CONFIRMED',
    allowedRoles: ['HUB'],
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'RECEIVED',
    to: 'ASSESSED',
    eventType: 'ASSESSMENT_RECORDED',
    allowedRoles: ['HUB'],
    requiresCurrentCustodianAuth: true,
  },
  {
    from: 'ASSESSED',
    to: 'ROUTED',
    eventType: 'ROUTING_CONFIRMED',
    allowedRoles: ['HUB'],
    requiresCurrentCustodianAuth: true,
  },
  {
    from: 'ROUTED',
    to: 'PROCESSING',
    eventType: 'PROCESSING_STARTED',
    allowedRoles: ['DESTINATION'],
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'PROCESSING',
    to: 'PROCESSED',
    eventType: 'PROCESSING_COMPLETED',
    allowedRoles: ['DESTINATION'],
    requiresCurrentCustodianAuth: true,
  },
  {
    from: 'PROCESSED',
    to: 'VERIFIED',
    eventType: 'VERIFICATION_COMPLETED',
    allowedRoles: ['ADMIN'], // authorized verifier
    requiresCurrentCustodianAuth: false,
  },
  {
    from: 'VERIFIED',
    to: 'CLOSED',
    eventType: 'CLOSURE_CONFIRMED',
    allowedRoles: ['DESTINATION', 'ADMIN'],
    requiresCurrentCustodianAuth: false,
  },
];

export const validateTransition = (
  currentState: LifecycleState,
  eventType: CustodyEventType,
  actorRole: ActorRole,
  isCurrentCustodian: boolean
): TransitionRule => {
  const rule = TransitionMatrix.find((r) => r.from === currentState && r.eventType === eventType);

  if (!rule) {
    throw new DomainError(
      `Invalid lifecycle transition from ${currentState} using event ${eventType}`,
      'VALIDATION_ERROR'
    );
  }

  if (!rule.allowedRoles.includes(actorRole)) {
    throw new DomainError(
      `Role ${actorRole} is not authorized to perform ${eventType}`,
      'FORBIDDEN'
    );
  }

  if (rule.requiresCurrentCustodianAuth && !isCurrentCustodian) {
    throw new DomainError('Must be the current custodian to perform this transition', 'FORBIDDEN');
  }

  return rule;
};
