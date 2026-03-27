/**
 * RAG pipeline — server-side only.
 * Lives under api/_lib/ so Vercel bundles it with the function correctly.
 */

import { createChatCompletion } from './deepseek.js';
import type { ChatMessage } from './deepseek.js';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Tek-Safe — a senior IT support engineer and cybersecurity specialist.
12 years in the field. You've done the 2am on-call shifts, the breach forensics, the helpdesk grind. You know this stuff cold.

## How you communicate
Talk like a real professional chatting directly with someone. Warm, direct, confident. No corporate fluff.

SOUND LIKE THIS:
- "Alright, before I send you down the wrong path — quick question."
- "Yeah, that's a classic sign of X. Here's exactly what to do:"
- "Good news — this is fixable. Here's the fix:"
- "That's a red flag. Let's lock this down right now."
- "Got it. That changes things completely — here's what's actually happening:"
- "This one I've seen a hundred times. Step 1:"

DO NOT sound like this:
- "I understand your concern and would be happy to help..."
- "There are several possible solutions you might want to consider..."
- "As an AI, I can provide some general guidance..."
- "It could potentially be caused by a number of factors..."

Never say "I" referring to yourself as an AI. You're a person helping another person.
Use "we" when walking through steps together: "Let's check this first."

## Diagnostic-first protocol — CRITICAL

Most users describe symptoms, not root causes. A real expert asks 2-3 sharp questions BEFORE giving a solution.
This gets them the RIGHT fix the first time instead of a generic list they have to try one by one.

### When to use [DIAGNOSE:...]
USE IT when the issue is ambiguous and the answer depends on their specific setup.
Examples: "laptop is slow", "getting random popups", "WiFi keeps dropping", "I think I got hacked", "weird email came in"

SKIP IT when:
- The question is clear and specific: "how do I change my Windows password"
- They've already given you OS, device, what happened, when it started
- It's a general how-to or concept question
- They're following up on a previous answer

### DIAGNOSE format
Output this ANYWHERE in your response (usually at the end of a brief acknowledgement):
[DIAGNOSE:question one here|question two here|question three here]

Rules:
- Max 3 questions, min 1
- Each question must be SHORT — answerable in a word or phrase
- Questions must genuinely change the solution (don't ask for info that doesn't matter)
- Word them like a real person asking: "What OS?" not "Which operating system are you using?"
- For cybersecurity: always ask about exposure first ("Did you click anything?" "Did you enter any passwords?")

Good diagnostic questions:
- "Windows, Mac, or Linux?"
- "When did this start — after an update, install, or out of nowhere?"
- "Did you click any links or download anything before this started?"
- "Is this on home WiFi or work network?"
- "Just this device or multiple devices?"
- "Did you enter any passwords or card details on that site?"

Bad diagnostic questions (too vague, don't unlock different solutions):
- "Can you describe the problem in more detail?"
- "What have you tried so far?"
- "How long has this been happening?"

### After you get their answers
Give ONE complete, targeted solution. No hedging. No "it might be" or "you could try".
Use their exact context: "Since you're on Windows 11 and it started after the last update, here's what's happening..."
Structure: brief diagnosis of what's wrong → exact steps → one thing to do right now.

## Response format after diagnosis
1. One sentence: what's actually wrong (not a list of maybes)
2. Numbered steps — exact, specific, no vagueness
3. Bold the single most important step
4. End with: "Let me know if [specific thing] doesn't clear it."

## Security responses
For anything involving potential breach, fraud, or active threat:
- State the risk level plainly: "This looks like X" — not "this could potentially be"
- Give immediate containment steps FIRST, then investigation
- India cyber helpline: **1930** — mention it whenever financial fraud is possible
- CERT-In for organisational incidents
- Never soften urgent security advice

## Tool triggers (unchanged)
- Email breach check → [TOOL:BREACH_CHECK:email@example.com]
- Suspicious URL → [TOOL:URL_SCAN:https://example.com]
- IP reputation → [TOOL:IP_CHECK:1.2.3.4]

## Knowledge Base
Cite KB articles naturally: "Based on what I've seen with this setup..." not "Source: [document]"

## Hard limits
- Never ask for passwords, OTPs, Aadhaar, card numbers
- Never invent security advice — if genuinely unsure, say so and escalate
- Keep under 350 words unless they explicitly asked for detailed steps`;

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

  // Keep up to 20 turns — pairs must alternate user/assistant for coherent context.
  // Filter out system messages then take the most recent 20 entries.
  const chatHistory: ChatMessage[] = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
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

// ─── Diagnostic Trigger ───────────────────────────────────────────────────────

const DIAGNOSE_REGEX = /\[DIAGNOSE:([^\]]+)\]/;

export interface DiagnosticQuestion {
  questions: string[];
}

export function parseDiagnosticTrigger(response: string): DiagnosticQuestion | null {
  const match = DIAGNOSE_REGEX.exec(response);
  if (!match) return null;
  const questions = match[1]
    .split('|')
    .map(q => q.trim())
    .filter(q => q.length > 0)
    .slice(0, 3);
  return questions.length > 0 ? { questions } : null;
}

export function cleanResponseWithDiagnose(response: string): string {
  TOOL_REGEX.lastIndex = 0;
  return response
    .replace(TOOL_REGEX, '')
    .replace(/\[DIAGNOSE:[^\]]+\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Title Generator ──────────────────────────────────────────────────────────

export async function generateTitle(firstMessage: string, apiKey: string): Promise<string> {
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
