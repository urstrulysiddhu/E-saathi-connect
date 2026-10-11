import { apiClient } from './client';
import { DeviceCreateInput, DeviceUpdateInput } from '@e-saathi/core';

export const devicesApi = {
  list: (params?: Record<string, string>) => apiClient.get('/devices', { params }),
  get: (deviceId: string) => apiClient.get(`/devices/${deviceId}`),
  create: (data: DeviceCreateInput) => apiClient.post('/devices', data),
  update: (deviceId: string, data: DeviceUpdateInput) =>
    apiClient.patch(`/devices/${deviceId}`, data),
};
