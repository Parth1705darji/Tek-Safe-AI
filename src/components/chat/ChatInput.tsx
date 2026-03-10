import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  messageCount?: number;
  messageLimit?: number;
  placeholder?: string;
}

const ChatInput = ({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  messageCount,
  messageLimit,
  placeholder = 'Ask Tek-Safe AI anything...',
}: ChatInputProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (up to 5 lines)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24;
    const maxLines = 5;
    el.style.height = Math.min(el.scrollHeight, lineHeight * maxLines + 32) + 'px';
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showRateLimit = messageCount !== undefined && messageLimit !== undefined && messageLimit !== Infinity;
  const nearLimit = showRateLimit && messageLimit - messageCount <= 5;
  const atLimit = showRateLimit && messageCount >= messageLimit;

  return (
    <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-3 dark:border-gray-800 dark:bg-dark-bg">
      <div className="mx-auto max-w-2xl">
        {/* Input row */}
        <div
          className={cn(
            'flex items-end gap-3 rounded-[12px] border bg-white px-4 py-3 shadow-sm transition-colors dark:bg-dark-surface',
            disabled || atLimit
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-gray-300 focus-within:border-primary dark:border-gray-600 dark:focus-within:border-accent'
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Generating response...' : placeholder}
            disabled={disabled || isStreaming || atLimit}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500 disabled:cursor-not-allowed"
            style={{ minHeight: '24px', maxHeight: '120px', overflowY: 'auto' }}
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gray-200 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled || atLimit}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-all duration-150 active:scale-95',
                value.trim() && !disabled && !atLimit
                  ? 'bg-accent text-white shadow-sm hover:bg-accent/90'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              )}
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isStreaming ? 'Generating...' : 'Shift+Enter for new line'}
          </p>

          {showRateLimit && (
            <p
              className={cn(
                'text-xs',
                atLimit
                  ? 'font-medium text-red-500'
                  : nearLimit
                  ? 'font-medium text-yellow-600 dark:text-yellow-500'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              {atLimit
                ? 'Daily limit reached. Resets at midnight.'
                : `${messageCount}/${messageLimit} messages today`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
