import { apiClient } from './client';
import { Notification } from '@e-saathi/core';

export const notificationsApi = {
  list: (): Promise<{ items: Notification[] }> =>
    apiClient.get('/notifications'),
    
  markAsRead: (notificationId: string): Promise<{ success: boolean }> =>
    apiClient.post(`/notifications/${notificationId}/read`),
};
