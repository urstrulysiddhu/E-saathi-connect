import { CommercialService } from '../src/domain/commercial-service';
import { AuthorizationContext } from '../src/domain/identity';
import { CommercialRepository } from '../src/infrastructure/repositories/commercial-repository';
import { CommercialTransaction } from '@e-saathi/core';

describe('CommercialService', () => {
  let commercialService: CommercialService;
  let commRepo: jest.Mocked<CommercialRepository>;

  beforeEach(() => {
    commRepo = {
      saveTerms: jest.fn(),
      saveOffer: jest.fn(),
      getOffer: jest.fn(),
      findApplicableOffers: jest.fn(),
      saveTransaction: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionsByDevice: jest.fn(),
      listTransactionsByDestination: jest.fn(),
      saveSettlement: jest.fn(),
      getSettlement: jest.fn(),
    } as unknown as jest.Mocked<CommercialRepository>;
    commercialService = new CommercialService(commRepo);
  });

  const ctxProposer: AuthorizationContext = {
    subject: 'sub-1', userId: 'user-1', actorId: 'act-1', organizationId: 'ORG-A', role: 'COLLECTOR',
    permissions: ['transaction:create', 'transaction:read', 'settlement:create', 'settlement:read', 'settlement:confirm_simulated'],
    actorStatus: 'ACTIVE', membershipStatus: 'ACTIVE', requestId: 'req-1',
  };

  const ctxReceiver: AuthorizationContext = {
    subject: 'sub-2', userId: 'user-2', actorId: 'act-2', organizationId: 'ORG-B', role: 'HUB',
    permissions: ['transaction:create', 'transaction:read'],
    actorStatus: 'ACTIVE', membershipStatus: 'ACTIVE', requestId: 'req-2',
  };

  const mockTx: CommercialTransaction = {
    transactionId: 'tx-1',
    deviceId: 'dev-1',
    sourceOrganizationId: 'ORG-A',
    destinationOrganizationId: 'ORG-B',
    proposedByActorId: 'act-1',
    proposedByOrganizationId: 'ORG-A',
    agreedAmount: 1500,
    fees: 100,
    netPayable: 1400,
    currency: 'INR',
    transactionStatus: 'PROPOSED',
    createdAt: '2026-01-01T00:00:00.000Z',
    version: 1,
  };

  it('proposes a transaction', async () => {
    commRepo.saveTransaction.mockResolvedValue(undefined);
    const tx = await commercialService.proposeTransaction(ctxProposer, {
      deviceId: 'dev-1',
      destinationOrganizationId: 'ORG-B',
      agreedAmount: 1500,
      fees: 100,
      netPayable: 1400,
      currency: 'INR',
    });
    expect(tx.transactionId).toBeDefined();
    expect(tx.agreedAmount).toBe(1500);
    expect(tx.transactionStatus).toBe('PROPOSED');
  });

  it('allows receiver to accept transaction', async () => {
    commRepo.getTransaction.mockResolvedValue(mockTx);
    commRepo.saveTransaction.mockResolvedValue(undefined);

    const accepted = await commercialService.acceptTransaction(ctxReceiver, 'tx-1', 1, 1500);
    expect(accepted.transactionStatus).toBe('ACCEPTED');
    expect(accepted.version).toBe(2);
  });

  it('rejects accept if amount or version changed', async () => {
    commRepo.getTransaction.mockResolvedValue(mockTx);
    await expect(
      commercialService.acceptTransaction(ctxReceiver, 'tx-1', 1, 1400)
    ).rejects.toThrow('Transaction terms have changed or are stale');
  });

  it('rejects accept by proposer organization', async () => {
    commRepo.getTransaction.mockResolvedValue(mockTx);
    await expect(
      commercialService.acceptTransaction(ctxProposer, 'tx-1', 1, 1500)
    ).rejects.toThrow('Only the receiving party can accept the transaction');
  });

  it('allows receiver to reject transaction', async () => {
    commRepo.getTransaction.mockResolvedValue(mockTx);
    commRepo.saveTransaction.mockResolvedValue(undefined);

    const rejected = await commercialService.rejectTransaction(ctxReceiver, 'tx-1', 'Terms unacceptable');
    expect(rejected.transactionStatus).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Terms unacceptable');
  });

  it('creates a settlement cleanly', async () => {
    commRepo.getTransaction.mockResolvedValue({ ...mockTx, transactionStatus: 'ACCEPTED' });
    commRepo.saveSettlement.mockResolvedValue(undefined);

    const settlement = await commercialService.createSettlement(ctxProposer, {
      transactionId: 'tx-1',
      amount: 1500,
    });

    expect(settlement.settlementId).toBeDefined();
    expect(settlement.settlementStatus).toBe('PENDING');
  });
});
