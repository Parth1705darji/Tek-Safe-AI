import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import InfrastructurePage from './InfrastructurePage';
import { useConversations } from '../hooks/useConversations';
import { useSupabase } from '../hooks/useSupabase';
import type { User } from '../types';

const InfrastructureFullPage = () => {
  const navigate = useNavigate();
  const { user: clerkUser, isLoaded } = useUser();
  const supabase = useSupabase();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbUser, setDbUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    let cancelled = false;
    const fetchUser = async () => {
      const result = (await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkUser.id)
        .single()) as { data: User | null; error: unknown };
      if (!cancelled && result.data) setDbUser(result.data);
    };
    fetchUser();
    return () => { cancelled = true; };
  }, [isLoaded, clerkUser, supabase]);

  const { groupedConversations, renameConversation, deleteConversation } = useConversations(dbUser?.id);

  const handleNewChat = useCallback(() => {
    setSidebarOpen(false);
    navigate('/chat');
  }, [navigate]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setSidebarOpen(false);
      navigate(`/chat/${id}`);
    },
    [navigate]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
    },
    [deleteConversation]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-light-bg dark:bg-dark-bg">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          groupedConversations={groupedConversations}
          activeId={undefined}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onRename={renameConversation}
          onDelete={handleDeleteConversation}
          onExport={() => {}}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex flex-1 flex-col overflow-y-auto">
          <InfrastructurePage />
        </main>
      </div>
    </div>
  );
};

export default InfrastructureFullPage;
