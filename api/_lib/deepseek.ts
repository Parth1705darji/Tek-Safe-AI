/**
 * DeepSeek API client — server-side only.
 * Lives under api/_lib/ so Vercel bundles it with the function correctly.
 */

const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

/** Non-streaming completion — used for short tasks like title generation. */
export async function createChatCompletion(
  options: CompletionOptions,
  apiKey: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: options.messages,
      stream: false,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 60,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content.trim();
}

/**
 * Streaming completion — returns the raw fetch Response so the caller
 * can pipe the SSE body to the client.
 */
export async function createStreamingCompletion(
  options: CompletionOptions,
  apiKey: string
): Promise<Response> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: options.messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`);
  }

  return res;
}
