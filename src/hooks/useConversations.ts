import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import type { Conversation } from '../types';

export type GroupedConversations = {
  today: Conversation[];
  yesterday: Conversation[];
  lastWeek: Conversation[];
  older: Conversation[];
};

function groupByDate(conversations: Conversation[]): GroupedConversations {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfLastWeek = new Date(startOfToday.getTime() - 7 * 86_400_000);

  return conversations.reduce<GroupedConversations>(
    (acc, conv) => {
      const d = new Date(conv.updated_at);
      if (d >= startOfToday) acc.today.push(conv);
      else if (d >= startOfYesterday) acc.yesterday.push(conv);
      else if (d >= startOfLastWeek) acc.lastWeek.push(conv);
      else acc.older.push(conv);
      return acc;
    },
    { today: [], yesterday: [], lastWeek: [], older: [] }
  );
}

export function useConversations(userId?: string) {
  const supabase = useSupabase();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      return;
    }
    setLoading(true);
    const result = (await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })) as {
      data: Conversation[] | null;
      error: unknown;
    };
    if (result.data) setConversations(result.data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(async (uid: string): Promise<Conversation | null> => {
    const result = (await supabase
      .from('conversations')
      .insert({ user_id: uid, title: 'New Chat' })
      .select()
      .single()) as { data: Conversation | null; error: unknown };
    if (result.data) {
      setConversations((prev) => [result.data!, ...prev]);
      return result.data;
    }
    return null;
  }, [supabase]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await supabase.from('conversations').update({ title }).eq('id', id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, [supabase]);

  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from('conversations').delete().eq('id', id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, [supabase]);

  return {
    conversations,
    groupedConversations: groupByDate(conversations),
    loading,
    createConversation,
    renameConversation,
    deleteConversation,
    refetch: fetchConversations,
  };
}
