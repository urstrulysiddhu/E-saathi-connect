import { apiClient } from './client';

export const routingApi = {
  getOptions: (deviceId: string) => apiClient.get(`/devices/${deviceId}/routing/options`),
  createDecision: (deviceId: string, selectedDestinationId: string) =>
    apiClient.post(`/devices/${deviceId}/routing/decisions`, { selectedDestinationId }),
};
