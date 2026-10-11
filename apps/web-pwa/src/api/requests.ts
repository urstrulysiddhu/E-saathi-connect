import { apiClient } from './client';
import { PickupRequest, CreatePickupRequestInput, RejectPickupRequestInput } from '@e-saathi/core';

export const requestsApi = {
  create: (input: CreatePickupRequestInput): Promise<PickupRequest> =>
    apiClient.post('/requests', input),

  list: (): Promise<{ items: PickupRequest[] }> =>
    apiClient.get('/requests'),

  accept: (requestId: string): Promise<PickupRequest> =>
    apiClient.post(`/requests/${requestId}/accept`, {}),

  reject: (requestId: string, input: RejectPickupRequestInput): Promise<PickupRequest> =>
    apiClient.post(`/requests/${requestId}/reject`, input),

  escalate: (requestId: string): Promise<PickupRequest> =>
    apiClient.post(`/requests/${requestId}/escalate`, {}),
};
