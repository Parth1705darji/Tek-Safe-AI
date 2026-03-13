import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import ChatInput from '../components/chat/ChatInput';
import WelcomeScreen from '../components/chat/WelcomeScreen';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { useSupabase } from '../hooks/useSupabase';
import { DAILY_LIMITS } from '../lib/utils';
import type { User } from '../types';

const ChatPage = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: clerkUser, isLoaded } = useUser();
  const supabase = useSupabase();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [dbUserLoading, setDbUserLoading] = useState(true);
  const [dbUserError, setDbUserError] = useState(false);

  // Fetch Supabase user record — called on mount and after each message
  const refetchUser = useCallback(async () => {
    if (!clerkUser) return;
    const result = (await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkUser.id)
      .single()) as { data: User | null; error: unknown };
    if (result.data) {
      setDbUser(result.data);
      setDbUserError(false);
    } else {
      setDbUserError(true);
    }
  }, [clerkUser, supabase]);

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    setDbUserLoading(true);
    refetchUser().finally(() => setDbUserLoading(false));
  }, [isLoaded, clerkUser, refetchUser]);

  const {
    groupedConversations,
    createConversation,
    renameConversation,
    deleteConversation,
    refetch: refetchConversations,
  } = useConversations(dbUser?.id);

  const { messages, isLoading, isStreaming, sendMessage, submitFeedback, stopGenerating } =
    useChat(conversationId, clerkUser?.id);

  // Listen for title-update events dispatched by useChat when server generates a title
  useEffect(() => {
    const handler = (e: Event) => {
      const { conversationId: convId, title } = (e as CustomEvent).detail as {
        conversationId: string;
        title: string;
      };
      renameConversation(convId, title);
    };
    window.addEventListener('teksafe:title-update', handler);
    return () => window.removeEventListener('teksafe:title-update', handler);
  }, [renameConversation]);

  // Track if we auto-fired a tool prompt so we only do it once
  const toolPromptFired = useRef(false);

  useEffect(() => {
    const state = location.state as { toolPrompt?: string } | null;
    if (state?.toolPrompt && !conversationId && !toolPromptFired.current) {
      toolPromptFired.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      handleSendMessage(state.toolPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, conversationId]);

  useEffect(() => {
    toolPromptFired.current = false;
  }, [conversationId]);

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

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!dbUser) return;

      let convId = conversationId;

      if (!convId) {
        const newConv = await createConversation(dbUser.id);
        if (!newConv) return;
        convId = newConv.id;
        navigate(`/chat/${convId}`, { replace: true });
      }

      await sendMessage(content, convId);

      // Refresh sidebar title/sort order and accurate message count.
      // refetchUser is awaited so the counter updates with the true DB value immediately.
      refetchConversations();
      await refetchUser();
    },
    [conversationId, dbUser, createConversation, navigate, sendMessage, refetchConversations, refetchUser]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversationId === id) navigate('/chat');
    },
    [conversationId, deleteConversation, navigate]
  );

  const messageLimit = dbUser ? (DAILY_LIMITS[dbUser.tier] ?? 50) : undefined;
  const messageCount = dbUser?.daily_message_count;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-light-bg dark:bg-dark-bg">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          groupedConversations={groupedConversations}
          activeId={conversationId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onRename={renameConversation}
          onDelete={handleDeleteConversation}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen onPromptClick={handleSendMessage} />
          ) : (
            <ChatArea
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onFeedback={submitFeedback}
            />
          )}

          {dbUserError && (
            <div className="mx-auto mb-2 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              Unable to load your account. Please refresh the page or sign out and sign back in.
            </div>
          )}

          <ChatInput
            onSend={handleSendMessage}
            onStop={stopGenerating}
            disabled={dbUserLoading || dbUserError}
            isStreaming={isStreaming}
            messageCount={messageCount}
            messageLimit={messageLimit}
          />
        </main>
      </div>
    </div>
  );
};

export default ChatPage;
