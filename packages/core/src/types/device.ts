import { LifecycleState, DataSafetyState } from './lifecycle';

export type DeviceCategory =
  | 'MOBILE_PHONE'
  | 'LAPTOP'
  | 'DESKTOP'
  | 'TABLET'
  | 'TELEVISION'
  | 'MONITOR'
  | 'PRINTER'
  | 'ROUTER'
  | 'SMALL_APPLIANCE'
  | 'LARGE_APPLIANCE'
  | 'OTHER';

export type DeviceCondition =
  'UNKNOWN' | 'WORKING' | 'PARTIALLY_WORKING' | 'NOT_WORKING' | 'DAMAGED' | 'FOR_PARTS';

export interface Device {
  deviceId: string;
  deviceType?: string;
  category: DeviceCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  assetTag?: string;
  description?: string;
  condition: DeviceCondition;
  indicativeValuation?: import('./valuation').IndicativeValuation;

  registeredByActorId: string;
  registeredByOrganizationId?: string;

  currentCustodianActorId?: string;
  currentCustodianOrganizationId?: string;

  lifecycleState: LifecycleState;
  dataSafetyState: DataSafetyState;

  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCreateInput {
  category: DeviceCategory;
  deviceType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  assetTag?: string;
  description?: string;
  condition?: DeviceCondition;
  idempotencyKey: string;
}

export interface DeviceUpdateInput {
  brand?: string;
  model?: string;
  condition?: DeviceCondition;
  description?: string;
  serialNumber?: string;
  imei?: string;
  assetTag?: string;
}

export interface DeviceListQuery {
  limit?: number;
  nextToken?: string;
}

export interface DeviceListResult {
  items: Device[];
  nextToken?: string;
}
