import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import BreachCheck from '../components/tools/BreachCheck';
import UrlScanner from '../components/tools/UrlScanner';
import IpChecker from '../components/tools/IpChecker';
import { useConversations } from '../hooks/useConversations';
import { useSupabase } from '../hooks/useSupabase';
import type { User } from '../types';

const TOOL_COMPONENTS: Record<string, React.ReactNode> = {
  'breach-check': <BreachCheck />,
  'url-scan': <UrlScanner />,
  'ip-check': <IpChecker />,
};

const ToolsPage = () => {
  const { tool } = useParams<{ tool: string }>();
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

  const toolComponent = tool ? TOOL_COMPONENTS[tool] : null;

  // Redirect unknown tool slugs to breach-check
  if (!toolComponent) {
    return <Navigate to="/tools/breach-check" replace />;
  }

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
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex flex-1 flex-col overflow-y-auto">
          {toolComponent}
        </main>
      </div>
    </div>
  );
};

export default ToolsPage;
