export type ActorRole = 'CONSUMER' | 'COLLECTOR' | 'HUB' | 'DESTINATION' | 'ADMIN';

export type OrganizationType =
  'COLLECTION_PARTNER' | 'HUB' | 'RECYCLER' | 'REFURBISHER' | 'NETWORK_OPERATOR' | 'OTHER';

export type ActorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface UserIdentity {
  userId: string;
  cognitoSubject: string;
  email: string;
  emailVerified: boolean;
  status: ActorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  organizationId: string;
  name: string;
  type: OrganizationType;
  status: 'ACTIVE' | 'SUSPENDED';
  verificationStatus: 'VERIFIED' | 'PENDING' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  membershipId: string;
  organizationId: string;
  actorId: string;
  role: ActorRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Actor {
  actorId: string;
  userId: string;
  organizationId?: string;
  role: ActorRole;
  status: ActorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Consumer extends Actor {
  role: 'CONSUMER';
}

export interface CollectionPartner extends Actor {
  role: 'COLLECTOR';
  organizationId: string;
}

export interface Hub extends Actor {
  role: 'HUB';
  organizationId: string;
}

export interface DestinationActor extends Actor {
  role: 'DESTINATION';
  organizationId: string;
  capabilities: string[];
  acceptedCategories: string[];
  authorizationValidity: string;
  operationalStatus: 'ACTIVE' | 'SUSPENDED';
}
