import { ActorRole } from './actors';

export type Permission =
  | 'device:read'
  | 'device:create'
  | 'device:update'
  | 'custody:request'
  | 'custody:accept'
  | 'custody:receive'
  | 'custody:assess'
  | 'custody:route'
  | 'custody:process'
  | 'custody:verify'
  | 'custody:close'
  | 'evidence:create'
  | 'evidence:read'
  | 'destination:create'
  | 'destination:read'
  | 'destination:update'
  | 'destination:manage'
  | 'network:manage'
  | 'network:read'
  | 'routing:read'
  | 'routing:create'
  | 'routing:approve'
  | 'offer:read'
  | 'offer:create'
  | 'offer:update'
  | 'transaction:read'
  | 'transaction:create'
  | 'settlement:read'
  | 'settlement:create'
  | 'settlement:confirm_simulated'
  | 'anomaly:read'
  | 'anomaly:review'
  | 'anomaly:resolve'
  | 'organization:read'
  | 'organization:manage'
  | 'actor:read'
  | 'actor:manage'
  | 'admin:read'
  | 'admin:manage';

export const RolePermissions: Record<ActorRole, Permission[]> = {
  CONSUMER: ['device:read', 'device:create', 'device:update', 'evidence:create', 'evidence:read'],
  COLLECTOR: [
    'device:read',
    'custody:accept',
    'custody:route',
    'evidence:create',
    'evidence:read',
    'network:read',
    'routing:read',
    'routing:create',
    'offer:read',
    'transaction:read',
    'transaction:create',
  ],
  HUB: [
    'device:read',
    'custody:receive',
    'custody:assess',
    'custody:route',
    'evidence:create',
    'evidence:read',
    'destination:read',
    'network:read',
    'network:manage',
    'routing:read',
    'routing:create',
    'offer:read',
    'transaction:read',
    'transaction:create',
  ],
  DESTINATION: [
    'device:read',
    'custody:receive',
    'custody:process',
    'custody:verify',
    'custody:route',
    'evidence:create',
    'evidence:read',
    'destination:read',
    'destination:update',
    'network:read',
    'routing:read',
    'routing:approve',
    'offer:read',
    'offer:create',
    'offer:update',
    'transaction:read',
    'transaction:create',
  ],
  ADMIN: [
    'device:read',
    'custody:request',
    'custody:route',
    'custody:verify',
    'custody:close',
    'evidence:read',
    'destination:create',
    'destination:read',
    'destination:update',
    'destination:manage',
    'network:read',
    'network:manage',
    'routing:read',
    'offer:read',
    'transaction:read',
    'settlement:read',
    'settlement:create',
    'settlement:confirm_simulated',
    'anomaly:read',
    'anomaly:review',
    'anomaly:resolve',
    'organization:read',
    'organization:manage',
    'actor:read',
    'actor:manage',
    'admin:read',
    'admin:manage',
  ],
};

export const hasPermission = (role: ActorRole, permission: Permission): boolean => {
  return RolePermissions[role].includes(permission);
};
