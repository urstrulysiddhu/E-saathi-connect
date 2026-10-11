import { apiClient } from './client';
import { CommercialTransaction } from '@e-saathi/core';

export interface ProposeInput {
  deviceId: string;
  destinationOrganizationId: string;
  agreedAmount: number;
  fees: number;
  netPayable: number;
  currency: string;
  itemizedTerms?: string;
}

export const commercialApi = {
  listTransactions: (): Promise<{ items: CommercialTransaction[] }> =>
    apiClient.get('/commercial/transactions'),
    
  proposeTransaction: (input: ProposeInput): Promise<CommercialTransaction> =>
    apiClient.post('/commercial/transactions', input),
    
  acceptTransaction: (transactionId: string, version: number, agreedAmount: number): Promise<CommercialTransaction> =>
    apiClient.post(`/commercial/transactions/${transactionId}/accept`, { version, agreedAmount }),
    
  rejectTransaction: (transactionId: string, reason: string): Promise<CommercialTransaction> =>
    apiClient.post(`/commercial/transactions/${transactionId}/reject`, { reason }),
    
  confirmSimulatedSettlement: (settlementId: string) =>
    apiClient.post(`/settlements/${settlementId}/confirm-simulated`),
};
