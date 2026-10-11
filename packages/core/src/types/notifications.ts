export interface Notification {
  notificationId: string;
  actorId: string;
  organizationId?: string;
  title: string;
  message: string;
  type: 'INFO' | 'ACTION_REQUIRED' | 'WARNING' | 'SUCCESS';
  status: 'UNREAD' | 'READ';
  createdAt: string;
  linkUrl?: string;
}

export interface CreateNotificationInput {
  actorId: string;
  organizationId?: string;
  title: string;
  message: string;
  type: 'INFO' | 'ACTION_REQUIRED' | 'WARNING' | 'SUCCESS';
  linkUrl?: string;
}
