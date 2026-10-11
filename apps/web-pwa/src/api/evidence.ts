import { apiClient } from './client';

export const evidenceApi = {
  uploadIntent: (deviceId: string, type: string, contentType: string, fileSizeBytes: number) =>
    apiClient.post('/evidence/upload-intent', { deviceId, evidenceType: type, contentType, fileSizeBytes }),
  complete: (evidenceId: string) => apiClient.post(`/evidence/${evidenceId}/complete`),
  listForDevice: (deviceId: string) => apiClient.get(`/devices/${deviceId}/evidence`),
  getAccessUrl: (evidenceId: string): Promise<{ accessUrl?: string; url?: string }> =>
    apiClient.get(`/evidence/${evidenceId}/access`),
};
