import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shield, Copy, Check } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import { showToast } from '../common/Toast';
import FeedbackWidget from './FeedbackWidget';
import ToolCard from './ToolCard';
import type { Message, BreachCheckResult, UrlScanResult, IpCheckResult } from '../../types';

// ─── Code block with copy button ─────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      showToast('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-100 px-4 py-2 dark:bg-gray-800">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copy</>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="overflow-x-auto bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ─── Markdown renderer for AI messages ───────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks and inline code
        code({ className, children }) {
          const language = /language-(\w+)/.exec(className || '')?.[1];
          const code = String(children).replace(/\n$/, '');
          const isBlock = code.includes('\n') || !!language;

          return isBlock ? (
            <CodeBlock code={code} language={language} />
          ) : (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-rose-600 dark:bg-gray-800 dark:text-rose-400">
              {children}
            </code>
          );
        },
        // Paragraphs
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
        },
        // Headings
        h1({ children }) {
          return <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-4 text-lg font-semibold text-gray-900 dark:text-white">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1.5 mt-3 text-base font-semibold text-gray-800 dark:text-gray-100">{children}</h3>;
        },
        // Lists
        ul({ children }) {
          return <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className="my-3 border-l-4 border-accent/60 pl-4 text-gray-600 dark:text-gray-400">
              {children}
            </blockquote>
          );
        },
        // Table
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="bg-gray-50 px-3 py-2 text-left font-semibold dark:bg-gray-800">
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">{children}</td>;
        },
        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 hover:text-accent/80"
            >
              {children}
            </a>
          );
        },
        // Horizontal rule
        hr() {
          return <hr className="my-4 border-gray-200 dark:border-gray-700" />;
        },
        // Strong / em
        strong({ children }) {
          return <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Copy all button ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg p-1 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      title="Copy response"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Main ChatMessage component ───────────────────────────────────────────────

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onFeedback: (messageId: string, feedback: 'up' | 'down', text?: string) => void;
}

const ChatMessage = ({ message, isStreaming = false, onFeedback }: ChatMessageProps) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[75%]">
          <div className="rounded-bubble rounded-br-[4px] bg-primary px-4 py-3 text-sm text-white shadow-sm">
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(message.created_at)}
          </p>
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex items-start gap-3 animate-slide-up">
      {/* AI avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
        <Shield className="h-4 w-4 text-accent" />
      </div>

      <div className="max-w-[80%] space-y-2">
        {/* Message bubble */}
        <div className="rounded-bubble rounded-tl-[4px] bg-gray-100 px-4 py-3 text-sm text-gray-800 shadow-sm dark:bg-dark-surface dark:text-gray-200">
          {/* Tool result card (inline) */}
          {message.tool_used && message.tool_result && (
            <div className="mb-3">
              {message.tool_used === 'breach_check' && (
                <ToolCard tool="breach_check" result={message.tool_result as BreachCheckResult} />
              )}
              {message.tool_used === 'url_scan' && (
                <ToolCard tool="url_scan" result={message.tool_result as UrlScanResult} />
              )}
              {message.tool_used === 'ip_check' && (
                <ToolCard tool="ip_check" result={message.tool_result as IpCheckResult} />
              )}
            </div>
          )}

          {/* Markdown content or streaming indicator */}
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            isStreaming && (
              <span className="inline-block h-4 w-2 animate-pulse bg-gray-400 dark:bg-gray-500 rounded-sm" />
            )
          )}

          {/* Source citations */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
              <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {message.sources.map((source) => (
                  <span
                    key={source.document_id}
                    className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                  >
                    {source.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message actions */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-1 pl-1">
            <CopyButton text={message.content} />
            <FeedbackWidget
              messageId={message.id}
              currentFeedback={message.feedback}
              onFeedback={onFeedback}
            />
            <p className="ml-1 text-xs text-gray-400 dark:text-gray-500">
              {formatRelativeTime(message.created_at)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
