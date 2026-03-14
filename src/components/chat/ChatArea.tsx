import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import ChatMessage from './ChatMessage';
import LoadingIndicator from './LoadingIndicator';
import type { Message } from '../../types';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  onFeedback: (messageId: string, feedback: 'up' | 'down', text?: string) => void;
}

const ChatArea = ({ messages, isLoading, isStreaming, onFeedback }: ChatAreaProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Detect when user scrolls away from the bottom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll only when user is already near the bottom
  useEffect(() => {
    if (!showScrollBtn) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, showScrollBtn]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-4 py-6 scrollbar-chat"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
              onFeedback={onFeedback}
            />
          ))}

          {/* Loading dots — show while waiting for first token */}
          {isLoading && <LoadingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button — appears when user scrolls up */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md transition-all hover:shadow-lg dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 animate-slide-up"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
};

export default ChatArea;
