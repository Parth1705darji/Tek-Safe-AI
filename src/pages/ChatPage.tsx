import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import ChatInput from '../components/chat/ChatInput';
import WelcomeScreen from '../components/chat/WelcomeScreen';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { useSupabase } from '../hooks/useSupabase';
import { DAILY_LIMITS } from '../lib/utils';
import { exportAsWord, exportAsExcel, exportAsPdf, exportAsHtml } from '../lib/exportChat';
import AnnouncementBanner from '../components/AnnouncementBanner';
import SkillSelector from '../components/chat/SkillSelector';
import type { User, Message } from '../types';
const ChatPage = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: clerkUser, isLoaded } = useUser();
  const supabase = useSupabase();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [dbUserLoading, setDbUserLoading] = useState(true);
  const [dbUserError, setDbUserError] = useState(false);
  // Holds a message queued for a brand-new conversation.
  // We create the conversation, navigate to its URL, then fire the message
  // only after conversationId has updated in the component — avoiding the
  // race condition where sendMessage runs while conversationId is still undefined.
  const pendingMessageRef = useRef<{ content: string; convId: string; attachmentContext?: string } | null>(null);
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
  const { messages, isLoading, isStreaming, sendMessage, submitFeedback, stopGenerating, answerDiagnostic } =
    useChat(conversationId, clerkUser?.id, activeSkills);
  // After navigating to a new conversation URL, fire any queued message.
  // This runs once conversationId has settled to the new value, guaranteeing
  // that useChat's message-load effect has already cleared state for the
  // new conversation before we add our first optimistic message.
  useEffect(() => {
    if (
      pendingMessageRef.current &&
      conversationId === pendingMessageRef.current.convId
    ) {
      const { content, convId, attachmentContext } = pendingMessageRef.current;
      pendingMessageRef.current = null;
      setTimeout(() => {
        sendMessage(content, convId, attachmentContext);
      }, 0);
    }
  }, [conversationId, sendMessage]);
  // Listen for title-update events dispatched by useChat
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
    async (content: string, attachmentContext?: string) => {
      if (!dbUser) return;
      // Existing conversation: send immediately
      if (conversationId) {
        await sendMessage(content, conversationId, attachmentContext);
        refetchConversations();
        await refetchUser();
        return;
      }
      // New conversation: create first, then queue the message.
      // We must NOT call sendMessage before navigate() has updated
      // conversationId, otherwise useChat's load effect (which clears
      // messages on conversationId change) would wipe our optimistic messages.
      const newConv = await createConversation(dbUser.id);
      if (!newConv) return;
      pendingMessageRef.current = { content, convId: newConv.id, attachmentContext };
      navigate(`/chat/${newConv.id}`, { replace: true });
      refetchConversations();
    },
    [conversationId, dbUser, createConversation, navigate, sendMessage, refetchConversations, refetchUser]
  );
  const activeConversationTitle = conversationId
    ? [
        ...groupedConversations.today,
        ...groupedConversations.yesterday,
        ...groupedConversations.lastWeek,
        ...groupedConversations.older,
      ].find((c) => c.id === conversationId)?.title ?? undefined
    : undefined;
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (conversationId === id) navigate('/chat');
    },
    [conversationId, deleteConversation, navigate]
  );

  const handleExportConversation = useCallback(
    async (id: string, format: 'word' | 'excel' | 'pdf' | 'html') => {
      const allConvs = [
        ...groupedConversations.today,
        ...groupedConversations.yesterday,
        ...groupedConversations.lastWeek,
        ...groupedConversations.older,
      ];
      const conv = allConvs.find((c) => c.id === id);
      const title = conv?.title ?? 'Chat Export';

      // If exporting the active conversation, use already-loaded messages
      let exportMessages: Message[] = [];
      if (id === conversationId && messages.length > 0) {
        exportMessages = messages;
      } else {
        // Fetch messages for any other conversation
        const result = (await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true })) as { data: Message[] | null; error: unknown };
        exportMessages = result.data ?? [];
      }

      if (exportMessages.length === 0) return;

      const exportFn = { word: exportAsWord, excel: exportAsExcel, pdf: exportAsPdf, html: exportAsHtml }[format];
      exportFn(exportMessages, title);
    },
    [conversationId, messages, groupedConversations, supabase]
  );
  const messageLimit = dbUser ? (DAILY_LIMITS[dbUser.tier] ?? 50) : undefined;
  const messageCount = dbUser?.daily_message_count;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-light-bg dark:bg-dark-bg">
      <Header
        onMenuClick={() => setSidebarOpen(true)}
        conversationTitle={activeConversationTitle}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          groupedConversations={groupedConversations}
          activeId={conversationId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onRename={renameConversation}
          onDelete={handleDeleteConversation}
          onExport={handleExportConversation}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <AnnouncementBanner />
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen onPromptClick={handleSendMessage} />
          ) : (
            <ChatArea
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onFeedback={submitFeedback}
              onDiagnosticAnswer={answerDiagnostic}
              conversationTitle={activeConversationTitle}
            />
          )}
          {dbUserError && (
            <div className="mx-auto mb-2 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              Unable to load your account. Please refresh the page or sign out and sign back in.
            </div>
          )}
          <div className="px-4 pb-1 pt-0">
            <SkillSelector activeSkills={activeSkills} onChange={setActiveSkills} />
          </div>
          <ChatInput
            onSend={handleSendMessage}
            onStop={stopGenerating}
            disabled={dbUserLoading || dbUserError || isLoading}
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
