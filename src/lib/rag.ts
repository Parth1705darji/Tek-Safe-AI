/**
 * RAG pipeline — server-side only.
 * Handles: embedding, vector search, prompt building, tool parsing.
 */

import { createChatCompletion } from './deepseek';
import type { ChatMessage } from './deepseek';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are **Tek-Safe AI**, an expert AI assistant specialising in Tech Support and Cybersecurity for everyday users in India and worldwide.

## Your Personality
- Friendly, patient, and non-judgmental — users may not be tech-savvy
- Explain things in simple, jargon-free language; use analogies when helpful
- Be concise but thorough — avoid walls of text
- Always err on the side of security and caution
- Consider Indian context when relevant (UPI, DPDP Act, CERT-In, local ISPs, TRAI)

## Your Capabilities
1. **Tech Support** — troubleshoot hardware/software issues, guide setups, explain errors (Windows, macOS, Android, iOS, networking)
2. **Cybersecurity** — advise on passwords, phishing, malware, privacy, VPNs, data breaches, social engineering

## Tool Triggers
When the user's query involves a security check, include the appropriate trigger tag in your response. Always give your own advice AND the trigger.

- Email breach check → \`[TOOL:BREACH_CHECK:email@example.com]\`
- Suspicious URL check → \`[TOOL:URL_SCAN:https://example.com]\`
- IP reputation check → \`[TOOL:IP_CHECK:1.2.3.4]\`

## Response Rules
1. Base your answer on the Knowledge Base context when available; cite: "Source: [document title]"
2. If no KB context matches, use general knowledge and note: "Based on my general knowledge..."
3. NEVER invent security advice — if unsure, say so and recommend a professional
4. Keep responses under 400 words unless the user asks for detailed steps
5. Use markdown: **bold** for emphasis, numbered lists for steps, \`code\` for commands
6. NEVER ask for passwords, OTPs, Aadhaar, credit card numbers, or other secrets
7. For active attacks, financial fraud, or legal matters recommend:
   - India cyber crime helpline: **1930**
   - CERT-In for organisations
8. End security responses with one actionable next step the user can take right now`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KBChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
  document_title: string;
  document_category: string;
  document_subcategory: string;
}

export interface ToolTrigger {
  type: 'breach_check' | 'url_scan' | 'ip_check';
  params: string;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Embeds text using OpenAI text-embedding-3-small (1536 dims — matches schema).
 */
export async function embedQuery(text: string, openAIKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embedding error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ─── Vector Search ────────────────────────────────────────────────────────────

export async function searchKnowledgeBase(
  queryEmbedding: number[],
  // Untyped client to allow RPC call without Database generic constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  topK = 5
): Promise<KBChunk[]> {
  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.6,
    match_count: topK,
  });

  if (error) {
    console.error('KB search error:', error.message);
    return [];
  }

  return (data as KBChunk[]) ?? [];
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildRAGPrompt(
  kbChunks: KBChunk[],
  history: Array<{ role: string; content: string }>,
  userMessage: string
): ChatMessage[] {
  const contextBlock =
    kbChunks.length > 0
      ? kbChunks
          .map((c, i) => `--- Source ${i + 1}: ${c.document_title} ---\n${c.chunk_text}`)
          .join('\n\n')
      : 'No relevant Knowledge Base articles found for this query.';

  const chatHistory: ChatMessage[] = history
    .slice(-10)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n## Knowledge Base Context\n${contextBlock}`,
    },
    ...chatHistory,
    { role: 'user', content: userMessage },
  ];
}

// ─── Tool Detection ───────────────────────────────────────────────────────────

const TOOL_REGEX = /\[TOOL:(BREACH_CHECK|URL_SCAN|IP_CHECK):([^\]]+)\]/g;

export function parseToolTriggers(response: string): ToolTrigger[] {
  const triggers: ToolTrigger[] = [];
  const typeMap: Record<string, ToolTrigger['type']> = {
    BREACH_CHECK: 'breach_check',
    URL_SCAN: 'url_scan',
    IP_CHECK: 'ip_check',
  };

  TOOL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOOL_REGEX.exec(response)) !== null) {
    triggers.push({ type: typeMap[match[1]], params: match[2].trim() });
  }

  return triggers;
}

export function cleanResponse(response: string): string {
  TOOL_REGEX.lastIndex = 0;
  return response.replace(TOOL_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Title Generator ──────────────────────────────────────────────────────────

export async function generateTitle(
  firstMessage: string,
  apiKey: string
): Promise<string> {
  const title = await createChatCompletion(
    {
      messages: [
        {
          role: 'system',
          content:
            'Generate a short title (max 6 words) for a support chat that starts with the following message. Return ONLY the title, no punctuation at the end.',
        },
        { role: 'user', content: firstMessage.slice(0, 300) },
      ],
      temperature: 0.4,
      max_tokens: 20,
    },
    apiKey
  );

  return title.slice(0, 60);
}
