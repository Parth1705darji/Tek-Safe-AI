import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from '../../../hooks/useAdminToken';
import { Search, ChevronLeft, ChevronRight, MessageSquare, X, User } from 'lucide-react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface ConvUser {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  user: ConvUser | null;
  message_count: number;
}

interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_used: string | null;
  created_at: string;
}

const ConversationBrowser = () => {
  const adminFetch = useAdminToken();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadUser, setThreadUser] = useState<ConvUser | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      const res = await adminFetch(`/api/admin/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [adminFetch, page, search]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openThread = async (conv: Conversation) => {
    setSelected(conv);
    setThread([]);
    setThreadLoading(true);
    try {
      const res = await adminFetch(`/api/admin/conversations?id=${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        setThread(data.messages ?? []);
        setThreadUser(data.user ?? null);
      }
    } finally {
      setThreadLoading(false);
    }
  };

  const closeThread = () => {
    setSelected(null);
    setThread([]);
    setThreadUser(null);
  };

  const getInitials = (u: ConvUser | null) => {
    if (!u) return '?';
    if (u.display_name) return u.display_name[0].toUpperCase();
    return u.email[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Conversations</h1>
        <p className="text-sm text-gray-400">{total} total conversations</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by user email or name..."
          className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none"
        />
      </div>

      <div className={`grid gap-6 ${selected ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Conversation List */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Title</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Msgs</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingSkeleton variant="table-row" count={8} />
                ) : conversations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                      {search ? 'No conversations match your search' : 'No conversations yet'}
                    </td>
                  </tr>
                ) : (
                  conversations.map(conv => (
                    <tr
                      key={conv.id}
                      onClick={() => openThread(conv)}
                      className={`cursor-pointer border-b border-gray-800/50 transition-colors ${
                        selected?.id === conv.id
                          ? 'bg-[#00D4AA]/10'
                          : 'hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {conv.user?.avatar_url ? (
                            <img src={conv.user.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-[10px] font-semibold text-white">
                              {getInitials(conv.user)}
                            </div>
                          )}
                          <span className="max-w-[120px] truncate text-xs text-gray-300">
                            {conv.user?.display_name ?? conv.user?.email ?? 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="max-w-[180px] truncate text-white">
                          {conv.title ?? 'Untitled'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1 text-gray-400">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {conv.message_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(conv.updated_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-800 px-5 py-3">
              <p className="text-xs text-gray-400">
                {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:text-white disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Thread Panel */}
        {selected && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 flex flex-col max-h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{selected.title ?? 'Untitled'}</p>
                {threadUser && (
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <User className="h-3 w-3" />
                    {threadUser.display_name ?? threadUser.email}
                  </p>
                )}
              </div>
              <button onClick={closeThread} className="ml-3 shrink-0 text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className="h-12 w-48 animate-pulse rounded-2xl bg-gray-800" />
                    </div>
                  ))}
                </div>
              ) : thread.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No messages</p>
              ) : (
                thread.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-[#00D4AA]/20 text-[#00D4AA]'
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      {msg.tool_used && (
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-purple-400">
                          [{msg.tool_used.replace('_', ' ')}]
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <p className={`mt-1 text-[10px] ${msg.role === 'user' ? 'text-[#00D4AA]/60' : 'text-gray-600'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationBrowser;
