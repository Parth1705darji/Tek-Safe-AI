import { useEffect, useRef } from 'react';
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

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-chat">
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
  );
};

export default ChatArea;
