import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from './AccessDenied';

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

export const RoleProtectedRoute = ({ children, allowedRoles }: RoleProtectedRouteProps) => {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasRole(allowedRoles)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};