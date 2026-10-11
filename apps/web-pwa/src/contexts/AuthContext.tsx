import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, authApi } from '../api/auth';

interface AuthContextType {
  user: UserSession | null;
  login: (emailOrRole: string, password?: string) => Promise<UserSession | void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = authApi.getSession();
    if (session) {
      setUser(session);
    }
    setIsLoading(false);
  }, []);

  const login = async (emailOrRole: string, password?: string) => {
    let session;
    if (password) {
      session = await authApi.cognitoLogin(emailOrRole, password);
    } else {
      session = await authApi.devLogin(emailOrRole as Parameters<typeof authApi.devLogin>[0]);
    }
    setUser(session);
    return session;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
