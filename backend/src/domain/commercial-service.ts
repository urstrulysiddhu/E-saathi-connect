import { CommercialRepository } from '../infrastructure/repositories/commercial-repository';
import {
  Offer,
  CommercialTransaction,
  Settlement,
  PartnerTerms,
  DomainError,
} from '@e-saathi/core';
import { AuthorizationContext } from './identity';
import { v4 as uuidv4 } from 'uuid';

export class CommercialService {
  constructor(private commercialRepo: CommercialRepository) {}

  async createTerms(
    ctx: AuthorizationContext,
    input: Omit<PartnerTerms, 'partnerTermsId' | 'status' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<PartnerTerms> {
    if (!ctx.permissions.includes('offer:create') && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Unauthorized to create terms', 'FORBIDDEN');
    }

    // Cross-org check: can only create terms if you are one of the parties, or admin
    if (
      input.fromOrganizationId !== ctx.organizationId &&
      input.toOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Cannot create terms for other organizations', 'FORBIDDEN');
    }

    const terms: PartnerTerms = {
      ...input,
      partnerTermsId: uuidv4(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await this.commercialRepo.saveTerms(terms);
    return terms;
  }

  async createOffer(
    ctx: AuthorizationContext,
    input: Omit<Offer, 'offerId' | 'status' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<Offer> {
    if (!ctx.permissions.includes('offer:create') && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Unauthorized to create offer', 'FORBIDDEN');
    }

    // Usually offers are created by the Destination or Hub
    if (
      input.destinationOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Cannot create offers on behalf of other organizations', 'FORBIDDEN');
    }

    const offer: Offer = {
      ...input,
      offerId: uuidv4(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await this.commercialRepo.saveOffer(offer);
    return offer;
  }

  async getOffer(ctx: AuthorizationContext, offerId: string): Promise<Offer> {
    const offer = await this.commercialRepo.getOffer(offerId);
    if (!offer) throw new DomainError('Offer not found', 'NOT_FOUND');

    if (!ctx.permissions.includes('offer:read') && !ctx.permissions.includes('admin:read')) {
      throw new DomainError('Unauthorized to read offer', 'FORBIDDEN');
    }

    if (
      offer.sourceOrganizationId !== ctx.organizationId &&
      offer.destinationOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:read')
    ) {
      throw new DomainError('Cannot read offers from other organizations', 'FORBIDDEN');
    }

    return offer;
  }

  async proposeTransaction(
    ctx: AuthorizationContext,
    input: {
      deviceId: string;
      destinationOrganizationId: string;
      agreedAmount: number;
      fees: number;
      netPayable: number;
      currency: string;
      itemizedTerms?: string;
    }
  ): Promise<CommercialTransaction> {
    if (!ctx.permissions.includes('transaction:create')) {
      throw new DomainError('Unauthorized to create transaction', 'FORBIDDEN');
    }

    if (!ctx.organizationId) {
      throw new DomainError('Organization ID is required to propose a transaction', 'VALIDATION_ERROR');
    }

    const tx: CommercialTransaction = {
      transactionId: uuidv4(),
      deviceId: input.deviceId,
      sourceOrganizationId: ctx.organizationId,
      destinationOrganizationId: input.destinationOrganizationId,
      proposedByActorId: ctx.actorId,
      proposedByOrganizationId: ctx.organizationId,
      agreedAmount: input.agreedAmount,
      fees: input.fees,
      netPayable: input.netPayable,
      itemizedTerms: input.itemizedTerms,
      currency: input.currency,
      transactionStatus: 'PROPOSED',
      createdAt: new Date().toISOString(),
      version: 1,
    };

    await this.commercialRepo.saveTransaction(tx);
    return tx;
  }

  async acceptTransaction(
    ctx: AuthorizationContext,
    transactionId: string,
    version: number,
    agreedAmount: number
  ): Promise<CommercialTransaction> {
    const tx = await this.getTransaction(ctx, transactionId);

    if (tx.transactionStatus !== 'PROPOSED') {
      throw new DomainError('Only proposed transactions can be accepted', 'VALIDATION_ERROR');
    }

    if (tx.version !== version || tx.agreedAmount !== agreedAmount) {
      throw new DomainError('Transaction terms have changed or are stale', 'CONFLICT');
    }

    // Only the receiving party can accept
    const receivingPartyId = tx.proposedByOrganizationId === tx.sourceOrganizationId 
      ? tx.destinationOrganizationId 
      : tx.sourceOrganizationId;

    if (ctx.organizationId !== receivingPartyId && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Only the receiving party can accept the transaction', 'FORBIDDEN');
    }

    const updated: CommercialTransaction = {
      ...tx,
      transactionStatus: 'ACCEPTED',
      acceptedAt: new Date().toISOString(),
      version: tx.version + 1,
    };

    await this.commercialRepo.saveTransaction(updated);
    return updated;
  }

  async rejectTransaction(
    ctx: AuthorizationContext,
    transactionId: string,
    reason: string
  ): Promise<CommercialTransaction> {
    const tx = await this.getTransaction(ctx, transactionId);

    if (tx.transactionStatus !== 'PROPOSED') {
      throw new DomainError('Only proposed transactions can be rejected', 'VALIDATION_ERROR');
    }

    const receivingPartyId = tx.proposedByOrganizationId === tx.sourceOrganizationId 
      ? tx.destinationOrganizationId 
      : tx.sourceOrganizationId;

    if (ctx.organizationId !== receivingPartyId && !ctx.permissions.includes('admin:manage')) {
      throw new DomainError('Only the receiving party can reject the transaction', 'FORBIDDEN');
    }

    if (!reason) {
      throw new DomainError('Rejection reason is required', 'VALIDATION_ERROR');
    }

    const updated: CommercialTransaction = {
      ...tx,
      transactionStatus: 'REJECTED',
      rejectionReason: reason,
      version: tx.version + 1,
    };

    await this.commercialRepo.saveTransaction(updated);
    return updated;
  }

  async getTransaction(ctx: AuthorizationContext, txId: string): Promise<CommercialTransaction> {
    const tx = await this.commercialRepo.getTransaction(txId);
    if (!tx) throw new DomainError('Transaction not found', 'NOT_FOUND');

    if (!ctx.permissions.includes('transaction:read') && !ctx.permissions.includes('admin:read')) {
      throw new DomainError('Unauthorized to read transaction', 'FORBIDDEN');
    }

    if (
      tx.sourceOrganizationId !== ctx.organizationId &&
      tx.destinationOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:read')
    ) {
      throw new DomainError('Cannot read transaction from other organizations', 'FORBIDDEN');
    }

    return tx;
  }

  async listTransactions(ctx: AuthorizationContext): Promise<{ items: CommercialTransaction[] }> {
    if (!ctx.permissions.includes('transaction:read')) {
      throw new DomainError('Unauthorized to read transactions', 'FORBIDDEN');
    }

    if (!ctx.organizationId) {
      throw new DomainError('Organization required', 'VALIDATION_ERROR');
    }

    const items = await this.commercialRepo.listTransactionsByDestination(ctx.organizationId);
    return { items };
  }

  async createSettlement(
    ctx: AuthorizationContext,
    input: { transactionId: string; amount: number }
  ): Promise<Settlement> {
    if (
      !ctx.permissions.includes('settlement:create') &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Unauthorized to create settlement', 'FORBIDDEN');
    }

    const tx = await this.getTransaction(ctx, input.transactionId);

    if (input.amount > tx.agreedAmount) {
      throw new DomainError(
        'Settlement amount cannot exceed agreed transaction amount',
        'VALIDATION_ERROR'
      );
    }

    // Settlements are generally driven by the paying party
    // For simplicity, verify the caller is one of the parties
    if (
      tx.sourceOrganizationId !== ctx.organizationId &&
      tx.destinationOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Cannot create settlement for other orgs', 'FORBIDDEN');
    }

    const settlement: Settlement = {
      settlementId: uuidv4(),
      transactionId: tx.transactionId,
      amount: input.amount,
      currency: tx.currency,
      settlementStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      version: 1,
    };

    await this.commercialRepo.saveSettlement(settlement);
    return settlement;
  }

  async confirmSimulatedSettlement(
    ctx: AuthorizationContext,
    settlementId: string
  ): Promise<Settlement> {
    if (
      !ctx.permissions.includes('settlement:confirm_simulated') &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Unauthorized to simulate settlement', 'FORBIDDEN');
    }

    const settlement = await this.commercialRepo.getSettlement(settlementId);
    if (!settlement) throw new DomainError('Settlement not found', 'NOT_FOUND');

    const tx = await this.commercialRepo.getTransaction(settlement.transactionId);
    if (!tx) throw new DomainError('Tx not found', 'NOT_FOUND');

    // Only allow simulation if it belongs to current org
    if (
      tx.sourceOrganizationId !== ctx.organizationId &&
      tx.destinationOrganizationId !== ctx.organizationId &&
      !ctx.permissions.includes('admin:manage')
    ) {
      throw new DomainError('Cannot confirm settlement for other orgs', 'FORBIDDEN');
    }

    if (settlement.settlementStatus !== 'PENDING') {
      throw new DomainError('Only pending settlements can be confirmed', 'VALIDATION_ERROR');
    }

    const updated: Settlement = {
      ...settlement,
      settlementStatus: 'SIMULATED',
      settledAt: new Date().toISOString(),
      version: (settlement.version || 1) + 1,
    };

    // Replace record (Optimistic locking should be used here, simplifying for MVP)
    await this.commercialRepo.saveSettlement(updated);

    return updated;
  }
}
