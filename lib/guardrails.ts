/**
 * Guardrails — server-side input/output safety checks.
 * Imported by api/chat.ts.
 */

import { createChatCompletion } from './deepseek.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputClassification = 'safe' | 'off_topic' | 'unsafe';

export type GuardrailConfig = {
  pii_check: boolean;
  off_topic_check: boolean;
  unsafe_check: boolean;
  output_pii_masking: boolean;
  off_topic_strictness: 'low' | 'medium' | 'high';
};

export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  pii_check: true,
  off_topic_check: true,
  unsafe_check: true,
  output_pii_masking: true,
  off_topic_strictness: 'medium',
};

// ─── Layer 2a: PII Detection (regex, synchronous) ─────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /\bpassword\s*(is|[:=])\s*\S+/i,
  /\bpwd\s*(is|[:=])\s*\S+/i,
  /\bpasscode\s*(is|[:=])\s*\S+/i,
  /\b(otp|one[\s-]time\s*pass(?:word|code)?)\s*(is|[:=])\s*\d{4,8}/i,
  /\bpin\s*(is|[:=])\s*\d{4,8}/i,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Aadhaar (12 digits)
  /\b(?:\d[ -]?){13,19}\b/, // credit/debit card (13–19 digits)
];

export function containsPII(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text));
}

// ─── Layer 2b: Input Classification (LLM-based, async) ────────────────────────

const STRICTNESS_ADDENDUM: Record<string, string> = {
  low: `
IMPORTANT — PERMISSIVE mode is active. Be very generous with "safe".
Only classify as off_topic if the message is completely and obviously unrelated to technology or security (e.g. a recipe, a sports score, a relationship question with zero tech angle). When in doubt, always choose safe.`,
  medium: `
When in doubt between safe and off_topic, always choose safe.`,
  high: `
IMPORTANT — STRICT mode is active. Classify as off_topic anything not directly about technology, software, cybersecurity, or India-specific digital/financial safety. General knowledge, science, culture, and vague questions should be off_topic unless they have a clear tech/security angle.`,
};

export function buildClassificationPrompt(strictness: 'low' | 'medium' | 'high' = 'medium'): string {
  return `You are a content classifier for a Tech Support and Cybersecurity assistant.
Classify the user message into exactly one category:

- safe: ALWAYS classify as safe if the message is any of:
  * Tech support, device issues, cybersecurity questions, online safety, privacy, VPNs, password management, malware, phishing, network issues, software troubleshooting
  * India-specific tech/security topics (UPI, Aadhaar security, CERT-In, TRAI, RBI alerts)
  * Feedback about the assistant's tone, quality, or responses (e.g. "your response is rude", "that was unhelpful", "you sound arrogant")
  * Expressions of frustration, confusion, or dissatisfaction with the conversation (e.g. "I don't understand", "this is confusing", "can you rephrase")
  * Meta-conversation or clarification requests (e.g. "what did you mean?", "can you explain differently", "where do you get your info")
  * Greetings, thanks, or short acknowledgements (e.g. "thanks", "ok", "got it", "hello")
  * Questions about the assistant itself, its capabilities, or its sources

- off_topic: cooking, relationships, entertainment, general knowledge unrelated to tech, creative writing, non-security finance, politics, sports — anything clearly not tech, security, or conversation about this assistant

- unsafe: hacking specific targets without permission, creating malware, bypassing security for unauthorized access, social engineering attack instructions, CSAM, violence
${STRICTNESS_ADDENDUM[strictness]}
Respond with ONLY ONE WORD: safe, off_topic, or unsafe`;
}

// Backward-compat export
export const CLASSIFICATION_SYSTEM_PROMPT = buildClassificationPrompt('medium');

export async function classifyInput(
  message: string,
  apiKey: string,
  strictness: 'low' | 'medium' | 'high' = 'medium'
): Promise<InputClassification> {
  const classify = createChatCompletion(
    {
      messages: [
        { role: 'system', content: buildClassificationPrompt(strictness) },
        { role: 'user', content: message.slice(0, 500) },
      ],
      temperature: 0.0,
      max_tokens: 5,
    },
    apiKey
  );
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 5000));
  try {
    const raw = await Promise.race([classify, timeout]);
    const label = raw.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    if (label.includes('unsafe')) return 'unsafe';
    if (label.includes('off_topic') || label.includes('offtopic')) return 'off_topic';
    return 'safe';
  } catch (err) {
    console.warn('classifyInput failed, defaulting to safe:', (err as Error).message);
    return 'safe';
  }
}

// ─── Layer 3a: Output PII Masking (regex, synchronous) ────────────────────────

const OUTPUT_PII_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[AADHAAR REDACTED]' },
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[CARD NUMBER REDACTED]' },
];

export function scanOutputForPII(text: string, enabled = true): string {
  if (!enabled) return text;
  return OUTPUT_PII_REPLACEMENTS.reduce(
    (t, { pattern, replacement }) => t.replace(pattern, replacement),
    text
  );
}

// ─── Layer 3b: Jailbreak Response Detection (string matching, synchronous) ────

const JAILBREAK_PHRASES = [
  "i'm dan",
  "i am dan",
  "as dan",
  "i have no restrictions",
  "i have no limitations",
  "ignore my previous instructions",
  "ignore all previous instructions",
  "as an ai with no restrictions",
  "without any restrictions",
  "i can do anything",
  "do anything now",
];

export function isJailbreakResponse(text: string): boolean {
  const lower = text.toLowerCase();
  return JAILBREAK_PHRASES.some((p) => lower.includes(p));
}
