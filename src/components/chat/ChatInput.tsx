import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Square, Paperclip, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AttachmentState {
  name: string;
  status: 'uploading' | 'safe' | 'unsafe' | 'error';
  context?: string;
  reason?: string;
}

interface ChatInputProps {
  onSend: (content: string, attachmentContext?: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  messageCount?: number;
  messageLimit?: number;
  placeholder?: string;
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
].join(',');

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
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea (up to 5 lines)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24;
    const maxLines = 5;
    el.style.height = Math.min(el.scrollHeight, lineHeight * maxLines + 32) + 'px';
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) fileInputRef.current!.value = '';
    if (!file) return;

    setAttachment({ name: file.name, status: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json() as {
        safe: boolean;
        extractedText?: string;
        filename?: string;
        reason?: string;
      };

      if (data.safe && data.extractedText) {
        const header = `[Attached file: ${data.filename ?? file.name}]\n\nExtracted content:\n${data.extractedText}\n\n`;
        setAttachment({ name: file.name, status: 'safe', context: header });
      } else {
        setAttachment({ name: file.name, status: 'unsafe', reason: data.reason ?? 'File failed safety check' });
      }
    } catch {
      setAttachment({ name: file.name, status: 'error', reason: 'Upload failed — please try again' });
    }

    // Reset file input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => setAttachment(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && !attachment) || disabled || isStreaming) return;
    if (attachment?.status === 'uploading') return;

    const ctx = attachment?.status === 'safe' ? attachment.context : undefined;
    onSend(trimmed || '.', ctx);
    setValue('');
    setAttachment(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setValue('');
    }
  };

  const showRateLimit = messageCount !== undefined && messageLimit !== undefined && messageLimit !== Infinity;
  const nearLimit = showRateLimit && messageLimit - messageCount <= 5;
  const atLimit = showRateLimit && messageCount >= messageLimit;

  const canSend = (value.trim() || attachment?.status === 'safe') && !disabled && !atLimit && attachment?.status !== 'uploading';

  return (
    <div className="border-t border-gray-200 bg-white px-4 pb-4 pt-3 dark:border-gray-800 dark:bg-dark-bg">
      <div className="mx-auto max-w-2xl">
        {/* Input row */}
        <div
          className={cn(
            'flex flex-col rounded-[12px] border bg-white shadow-sm transition-colors dark:bg-dark-surface',
            disabled || atLimit
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-gray-300 focus-within:border-primary dark:border-gray-600 dark:focus-within:border-accent'
          )}
        >
          {/* Attachment preview strip */}
          {attachment && (
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              {attachment.status === 'uploading' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 truncate max-w-[200px]">{attachment.name}</span>
                  <span className="text-xs text-gray-400">Checking safety…</span>
                </>
              )}
              {attachment.status === 'safe' && (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[220px]">{attachment.name}</span>
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">Safe</span>
                </>
              )}
              {(attachment.status === 'unsafe' || attachment.status === 'error') && (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{attachment.name}</span>
                  <span className="text-xs text-red-600 dark:text-red-400 truncate">{attachment.reason}</span>
                </>
              )}
              <button
                type="button"
                onClick={removeAttachment}
                className="ml-auto shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Text + buttons row */}
          <div className="flex items-end gap-3 px-4 py-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Paperclip button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming || atLimit || attachment?.status === 'uploading'}
              className={cn(
                'shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                attachment?.status === 'safe' && 'text-accent'
              )}
              title="Attach file (PNG, JPEG, PDF, DOCX, XLSX)"
            >
              <Paperclip className="h-5 w-5" />
            </button>

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
                disabled={!canSend}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-all duration-150 active:scale-95',
                  canSend
                    ? 'bg-accent text-white shadow-sm hover:bg-accent/90'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                )}
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isStreaming ? 'Generating...' : 'Shift+Enter for new line · Esc to clear · 📎 PNG, JPEG, PDF, DOCX, XLSX'}
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
