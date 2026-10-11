import { ActorRole } from '@e-saathi/core';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

export interface UserSession {
  userId: string;
  actorId: string;
  organizationId?: string;
  role: ActorRole;
  name: string;
}

const DEMO_USERS: Record<string, UserSession> = {
  consumer: { userId: 'u-1', actorId: 'a-1', role: 'CONSUMER', name: 'John Doe' },
  collector: {
    userId: 'u-2',
    actorId: 'a-2',
    organizationId: 'org-collector-1',
    role: 'COLLECTOR',
    name: 'Rapid Collect',
  },
  hub: {
    userId: 'u-3',
    actorId: 'a-3',
    organizationId: 'org-hub-1',
    role: 'HUB',
    name: 'Central E-Waste Hub',
  },
  destination: {
    userId: 'u-4',
    actorId: 'a-4',
    organizationId: 'org-dest-1',
    role: 'DESTINATION',
    name: 'ReNova Refurbishment',
  },
  admin: {
    userId: 'u-5',
    actorId: 'a-5',
    organizationId: 'org-esaathi',
    role: 'ADMIN',
    name: 'System Admin',
  },
};

const getPool = () => {
  const poolId = import.meta.env.VITE_USER_POOL_ID;
  const clientId = import.meta.env.VITE_CLIENT_ID;
  if (!poolId || !clientId) return null;
  return new CognitoUserPool({
    UserPoolId: poolId,
    ClientId: clientId,
  });
};

export const authApi = {
  cognitoLogin: (email: string, password: string): Promise<UserSession> => {
    return new Promise((resolve, reject) => {
      const pool = getPool();
      if (!pool) return reject(new Error('Cognito configuration missing'));

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: pool,
      });

      const handleSuccess = (result: CognitoUserSession) => {
        const jwt = result.getIdToken().getJwtToken();
        const payload = result.getIdToken().payload;

        localStorage.setItem('authToken', jwt);

        const role = (payload['custom:role'] as ActorRole) || 'CONSUMER';
        const orgId = payload['custom:org'] as string | undefined;
        const subject = payload.sub;

        const session: UserSession = {
          userId: `user_${subject}`,
          actorId: `actor_${subject}`,
          organizationId: orgId,
          role,
          name: payload.email || email,
        };

        localStorage.setItem('demo_session', JSON.stringify(session));
        resolve(session);
      };

      const callbacks = {
        onSuccess: handleSuccess,
        onFailure: (err: Error) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes: Record<string, string>) => {
          delete userAttributes.email_verified;
          delete userAttributes.phone_number_verified;
          cognitoUser.completeNewPasswordChallenge(password, userAttributes, {
            onSuccess: handleSuccess,
            onFailure: (err: Error) => reject(err),
          });
        },
      };

      cognitoUser.authenticateUser(authenticationDetails, callbacks);
    });
  },

  devLogin: async (roleKey: keyof typeof DEMO_USERS): Promise<UserSession> => {
    if (import.meta.env.PROD) {
      throw new Error('DEV Login cannot be used in production.');
    }
    const user = DEMO_USERS[roleKey];
    localStorage.setItem('demo_session', JSON.stringify(user));
    localStorage.setItem('authToken', `DEV_TOKEN_${roleKey}`);
    return user;
  },

  logout: () => {
    const pool = getPool();
    if (pool) {
      const user = pool.getCurrentUser();
      if (user) {
        user.signOut();
      }
    }
    localStorage.removeItem('demo_session');
    localStorage.removeItem('authToken');
  },

  getSession: (): UserSession | null => {
    const session = localStorage.getItem('demo_session');
    return session ? JSON.parse(session) : null;
  },
};
