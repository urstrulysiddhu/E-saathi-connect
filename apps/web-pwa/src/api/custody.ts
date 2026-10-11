import { apiClient } from './client';
import { CustodyEvent } from '@e-saathi/core';

export const custodyApi = {
  transition: (
    deviceId: string,
    eventType: string,
    expectedVersion: number,
    data?: Record<string, unknown>
  ) =>
    apiClient.post(`/devices/${deviceId}/custody/transition`, {
      eventType,
      expectedVersion,
      idempotencyKey: Math.random().toString(36).substring(7),
      ...data,
    }),

  getTimeline: (deviceId: string): Promise<CustodyEvent[]> =>
    apiClient.get(`/devices/${deviceId}/custody`),

  verifyChain: (
    deviceId: string
  ): Promise<{ valid: boolean; chainLength: number; checkedAt: string }> =>
    apiClient.get(`/devices/${deviceId}/custody/verify`),
};
