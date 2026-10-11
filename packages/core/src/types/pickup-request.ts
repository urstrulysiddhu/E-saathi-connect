export type PickupRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface PickupRequest {
  requestId: string;
  deviceId: string;
  consumerActorId: string;
  status: PickupRequestStatus;
  pickupAddress: string;
  pickupDate: string;
  
  assignedCollectorOrganizationId?: string;
  assignedCollectorActorId?: string;
  
  rejectionReason?: string;
  rejectedByActorId?: string;
  rejectedByOrganizationId?: string;
  
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreatePickupRequestInput {
  deviceId: string;
  pickupAddress: string;
  pickupDate: string;
}

export interface RejectPickupRequestInput {
  reason: string;
}
