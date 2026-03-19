import { useUser } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '../../lib/roles';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isLoaded, isSignedIn } = useUser();
  const isAdmin = useIsAdmin();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D4AA] border-t-transparent" />
          <p className="text-sm text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
