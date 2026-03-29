import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { MessageSquare, X, Send, Loader2, ChevronRight, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InfraChatProps {
  agentId: string;
  isOpen: boolean;
  onToggle: () => void;
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
}

const InfraChat = ({ agentId, isOpen, onToggle, initialMessage, onInitialMessageConsumed }: InfraChatProps) => {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialSentRef = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch('/api/infrastructure/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ message: trimmed, agentId }),
      });

      const data = await res.json() as { response?: string; error?: string };

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error ?? 'Something went wrong'}` }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response ?? '' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach the infrastructure chat service. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [agentId, getToken, loading]);

  // Auto-send initialMessage once
  useEffect(() => {
    if (initialMessage && isOpen && !initialSentRef.current) {
      initialSentRef.current = true;
      onInitialMessageConsumed?.();
      sendMessage(initialMessage);
    }
  }, [initialMessage, isOpen, sendMessage, onInitialMessageConsumed]);

  // Reset initial sent flag when panel re-opens with a new message
  useEffect(() => {
    if (!isOpen) initialSentRef.current = false;
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className={[
          'fixed right-4 bottom-6 z-30 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all',
          isOpen
            ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
            : 'bg-[#00D4AA] text-white hover:bg-[#00D4AA]/90',
        ].join(' ')}
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        {isOpen ? 'Close' : 'Ask AI'}
        {!isOpen && <ChevronRight className="h-3 w-3" />}
      </button>

      {/* Chat panel */}
      <div
        className={[
          'fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-gray-800 bg-gray-900 shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D4AA]/20">
              <Bot className="h-4 w-4 text-[#00D4AA]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Infrastructure AI</p>
              <p className="text-xs text-gray-500">Ask about your network</p>
            </div>
          </div>
          <button onClick={onToggle} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="py-6 text-center">
              <Bot className="mx-auto mb-3 h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-400">Ask anything about your network</p>
              <div className="mt-4 space-y-2">
                {[
                  'What are my most critical vulnerabilities?',
                  'Which devices need urgent patching?',
                  'Are any devices internet-facing with risky ports?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:bg-gray-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={[
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-[#00D4AA]/20 text-[#00D4AA] rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm',
                ].join(' ')}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00D4AA]" />
                <span className="text-xs text-gray-400">Analyzing your infrastructure…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your network…"
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-[#00D4AA]/50 focus:outline-none focus:ring-1 focus:ring-[#00D4AA]/20 disabled:opacity-50"
              style={{ maxHeight: '100px', overflowY: 'auto' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00D4AA] text-white transition-all hover:bg-[#00D4AA]/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-gray-600">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  );
};

export default InfraChat;
