export type DestinationType = 'RECYCLER' | 'REFURBISHER' | 'PROCESSING_FACILITY' | 'OTHER';

export type AuthorizationStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

export type OperationalStatus = 'OPERATIONAL' | 'LIMITED' | 'PAUSED' | 'OFFLINE';

export type DestinationCapability =
  | 'REFURBISHING'
  | 'MATERIAL_RECOVERY'
  | 'BATTERY_HANDLING'
  | 'DATA_WIPE'
  | 'DISASSEMBLY'
  | 'PRECIOUS_METAL_RECOVERY'
  | 'PLASTIC_RECOVERY'
  | 'OTHER';

export interface Destination {
  destinationId: string;
  organizationId: string;
  name: string;
  destinationType: DestinationType;
  authorizationStatus: AuthorizationStatus;
  authorizationReference: string;
  authorizationValidFrom: string;
  authorizationValidUntil: string;
  operationalStatus: OperationalStatus;
  acceptedDeviceCategories: string[];
  acceptedConditions: string[];
  capabilities: DestinationCapability[];
  serviceAreas: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type RelationshipType =
  | 'COLLECTION_TO_HUB'
  | 'HUB_TO_DESTINATION'
  | 'DIRECT_COLLECTION_TO_DESTINATION'
  | 'NETWORK_PARTNER'
  | 'OTHER';

export type RelationshipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

export interface NetworkRelationship {
  relationshipId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  effectiveFrom: string;
  effectiveUntil: string;
  createdAt: string;
  updatedAt: string;
}

export type RoutingDecisionStatus =
  'PROPOSED' | 'APPROVED' | 'DISPATCHED' | 'CANCELLED' | 'REJECTED' | 'COMPLETED';

export interface RoutingDecision {
  routingDecisionId: string;
  deviceId: string;
  sourceOrganizationId: string;
  sourceActorId: string;
  selectedDestinationId: string;
  selectedRelationshipId: string;
  eligibilitySnapshot: Record<string, unknown>;
  decisionReason: string;
  decisionStatus: RoutingDecisionStatus;
  createdAt: string;
  createdByActorId: string;
  version: number;
}

export interface EligibilityResult {
  destinationId: string;
  organizationId?: string;
  destinationName?: string;
  destinationType?: DestinationType;
  authorizationStatus?: AuthorizationStatus;
  authorizationReference?: string;
  eligible: boolean;
  reasons: string[];
  failedRules: string[];
}
