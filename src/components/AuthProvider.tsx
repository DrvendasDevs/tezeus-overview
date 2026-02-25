import { ReactNode } from 'react';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { SessionMonitor } from '@/components/SessionMonitor';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>
      <SessionMonitor />
      {children}
    </AuthContext.Provider>
  );
};