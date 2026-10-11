export type TermsType =
  'FIXED_FEE' | 'PER_UNIT' | 'CATEGORY_BASED' | 'WEIGHT_BASED' | 'REV_SHARE' | 'NO_FEE' | 'OTHER';

export type PartnerTermsStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface PartnerTerms {
  partnerTermsId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  currency: string;
  termsType: TermsType;
  effectiveFrom: string;
  effectiveUntil: string;
  status: PartnerTermsStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type OfferStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'WITHDRAWN' | 'ACCEPTED' | 'REJECTED';

export interface Offer {
  offerId: string;
  partnerTermsId: string;
  sourceOrganizationId: string;
  destinationOrganizationId: string;
  deviceCategory: string;
  condition: string;
  amount: number;
  currency: string;
  validFrom: string;
  validUntil: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

export type TransactionStatus =
  'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SETTLED' | 'CANCELLED' | 'DISPUTED';

export interface CommercialTransaction {
  transactionId: string;
  deviceId: string;
  offerId?: string;
  sourceOrganizationId: string;
  destinationOrganizationId: string;
  proposedByActorId: string;
  proposedByOrganizationId: string;
  agreedAmount: number;
  fees: number;
  netPayable: number;
  itemizedTerms?: string;
  currency: string;
  transactionStatus: TransactionStatus;
  rejectionReason?: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  settledAt?: string;
  version: number;
}

export type SettlementStatus = 'PENDING' | 'SIMULATED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface Settlement {
  settlementId: string;
  transactionId: string;
  amount: number;
  currency: string;
  settlementStatus: SettlementStatus;
  settlementReference?: string;
  createdAt: string;
  settledAt?: string;
  version?: number;
}
