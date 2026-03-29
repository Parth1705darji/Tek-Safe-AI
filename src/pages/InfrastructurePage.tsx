import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Shield } from 'lucide-react';
import SetupWizard from '../components/infrastructure/SetupWizard';
import InfrastructureMap from '../components/infrastructure/InfrastructureMap';
import type { ActivationStatus } from '../types';

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D4AA]/10">
          <Shield className="h-6 w-6 animate-pulse text-[#00D4AA]" />
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

const InfrastructurePage = () => {
  const { getToken } = useAuth();
  const [agentStatus, setAgentStatus] = useState<ActivationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/infrastructure/activation', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data as ActivationStatus);
      } else {
        // If unauthenticated or error, default to showing setup
        setAgentStatus({ status: 'none' });
      }
    } catch {
      setAgentStatus({ status: 'none' });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) return <PageLoader />;

  if (!agentStatus || agentStatus.status === 'none') {
    // Need to fetch a code — show wizard at step 1 but no code yet
    return (
      <SetupWizard initialStep={1} activationCode="" />
    );
  }

  if (agentStatus.status === 'active') {
    return <InfrastructureMap />;
  }

  // pending or offline — show wizard at step 3 (activation)
  return (
    <SetupWizard
      initialStep={agentStatus.status === 'pending' ? 3 : 3}
      activationCode={agentStatus.activation_code}
    />
  );
};

export default InfrastructurePage;
