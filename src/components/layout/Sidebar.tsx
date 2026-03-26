import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Shield,
  Link2,
  Globe,
  Lock,
  Search,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  Download,
  FileText,
  TableProperties,
  Printer,
} from 'lucide-react';
import { cn, truncate } from '../../lib/utils';
import type { GroupedConversations } from '../../hooks/useConversations';
import type { Conversation } from '../../types';

interface SidebarProps {
  groupedConversations: GroupedConversations;
  activeId?: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: 'word' | 'excel' | 'pdf' | 'html') => void;
  isOpen?: boolean;         // mobile drawer open
  onClose?: () => void;     // mobile drawer close
}

const EXPORT_FORMATS: { label: string; icon: React.ElementType; format: 'word' | 'excel' | 'pdf' | 'html' }[] = [
  { label: 'Word (.doc)', icon: FileText, format: 'word' },
  { label: 'Excel (.xls)', icon: TableProperties, format: 'excel' },
  { label: 'PDF (print)', icon: Printer, format: 'pdf' },
  { label: 'HTML (.html)', icon: Globe, format: 'html' },
];

function ConversationItem({
  conv,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onExport,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onExport: (format: 'word' | 'excel' | 'pdf' | 'html') => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.title ?? 'Chat');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) onRename(renameValue.trim());
    setRenaming(false);
  };

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors duration-100',
        isActive
          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-accent'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'
      )}
      onClick={() => !renaming && onSelect()}
    >
      <MessageSquare className="mr-2.5 h-3.5 w-3.5 shrink-0 opacity-60" />

      {renaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') setRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{truncate(conv.title ?? 'Chat', 28)}</span>
      )}

      {/* Three-dot menu — visible on hover or when active */}
      {!renaming && (
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'ml-1 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100',
              menuOpen && 'opacity-100',
              isActive && 'opacity-60 group-hover:opacity-100'
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-7 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-dark-surface overflow-hidden">
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60"
                onClick={() => { setMenuOpen(false); setRenaming(true); setRenameValue(conv.title ?? 'Chat'); }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>

              {/* Export — inline accordion */}
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60"
                onClick={(e) => { e.stopPropagation(); setExportOpen((o) => !o); }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <span className={`ml-auto text-gray-400 transition-transform duration-150 ${exportOpen ? 'rotate-90' : ''}`}>›</span>
              </button>
              {exportOpen && (
                <div className="border-t border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40">
                  {EXPORT_FORMATS.map(({ label, icon: Icon, format }) => (
                    <button
                      key={format}
                      className="flex w-full items-center gap-2 pl-7 pr-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60"
                      onClick={() => { setMenuOpen(false); setExportOpen(false); onExport(format); }}
                    >
                      <Icon className="h-3 w-3 text-accent" />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarGroup({ label, conversations, activeId, onSelect, onRename, onDelete, onExport }: {
  label: string;
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: 'word' | 'excel' | 'pdf' | 'html') => void;
}) {
  if (conversations.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <div className="space-y-0.5">
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conv={conv}
            isActive={activeId === conv.id}
            onSelect={() => onSelect(conv.id)}
            onRename={(title) => onRename(conv.id, title)}
            onDelete={() => onDelete(conv.id)}
            onExport={(format) => onExport(conv.id, format)}
          />
        ))}
      </div>
    </div>
  );
}

// Tools that navigate to dedicated pages
const ROUTE_TOOLS = [
  { icon: Shield, label: 'Breach Check', route: '/tools/breach-check' },
  { icon: Link2, label: 'URL Scanner', route: '/tools/url-scan' },
  { icon: Globe, label: 'IP Checker', route: '/tools/ip-check' },
];

// Tools that pre-fill chat with a security prompt
const PROMPT_TOOLS = [
  {
    icon: Lock,
    label: 'SSL Checker',
    prompt: 'Check the SSL/TLS certificate status and security configuration for: [paste domain here]',
  },
  {
    icon: FileSearch,
    label: 'WHOIS Lookup',
    prompt: 'Perform a WHOIS analysis on this domain and flag any suspicious registration patterns: [paste domain here]',
  },
];

const SidebarContent = ({
  groupedConversations,
  activeId,
  onNewChat,
  onSelectChat,
  onRename,
  onDelete,
  onExport,
  onClose,
}: Omit<SidebarProps, 'isOpen'>) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);

  function filterGroup(convs: Conversation[]) {
    if (!search.trim()) return convs;
    const q = search.toLowerCase();
    return convs.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }

  const handlePromptTool = (prompt: string) => {
    onClose?.();
    navigate('/chat', { state: { toolPrompt: prompt } });
  };

  return (
    <div className="flex h-full flex-col">
      {/* New Chat button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-card bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none dark:text-gray-300 dark:placeholder-gray-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-1 py-1 scrollbar-chat">
        {search.trim() && filterGroup([
          ...groupedConversations.today,
          ...groupedConversations.yesterday,
          ...groupedConversations.lastWeek,
          ...groupedConversations.older,
        ]).length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            No conversations match "{search}"
          </p>
        ) : (
          <>
            <SidebarGroup
              label="Today"
              conversations={filterGroup(groupedConversations.today)}
              activeId={activeId}
              onSelect={onSelectChat}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
            <SidebarGroup
              label="Yesterday"
              conversations={filterGroup(groupedConversations.yesterday)}
              activeId={activeId}
              onSelect={onSelectChat}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
            <SidebarGroup
              label="Previous 7 Days"
              conversations={filterGroup(groupedConversations.lastWeek)}
              activeId={activeId}
              onSelect={onSelectChat}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
            <SidebarGroup
              label="Older"
              conversations={filterGroup(groupedConversations.older)}
              activeId={activeId}
              onSelect={onSelectChat}
              onRename={onRename}
              onDelete={onDelete}
              onExport={onExport}
            />
          </>
        )}
      </div>

      {/* Tools section — collapsible tray */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        {/* Toggle header — always visible */}
        <button
          onClick={() => setToolsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <span>Security Tools</span>
          <ChevronUp
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              toolsOpen ? 'rotate-0' : 'rotate-180'
            )}
          />
        </button>

        {/* Collapsible tool list — slides up from bottom */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-in-out',
            toolsOpen ? 'max-h-64 opacity-100 pb-3' : 'max-h-0 opacity-0'
          )}
        >
          <div className="space-y-0.5 px-3">
            {ROUTE_TOOLS.map(({ icon: Icon, label, route }) => (
              <button
                key={label}
                onClick={() => {
                  onClose?.();
                  navigate(route);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/60"
              >
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </button>
            ))}
            {PROMPT_TOOLS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => handlePromptTool(prompt)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/60"
              >
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

const Sidebar = (props: SidebarProps) => {
  const { isOpen, onClose } = props;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-dark-bg md:flex md:flex-col">
        <SidebarContent {...props} onClose={onClose} />
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={onClose}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-dark-bg animate-slide-up">
            <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Menu</span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <SidebarContent {...props} />
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
