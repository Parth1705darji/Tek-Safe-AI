/**
 * Guardrails — server-side input/output safety checks.
 * Imported by api/chat.ts.
 */

import { createChatCompletion } from './deepseek.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputClassification = 'safe' | 'off_topic' | 'unsafe';

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

export const CLASSIFICATION_SYSTEM_PROMPT =
  `You are a content classifier for a Tech Support and Cybersecurity assistant.
Classify the user message into exactly one category:
- safe: tech support, device issues, cybersecurity questions, online safety, privacy, VPNs, password management, malware, phishing, network issues, software troubleshooting, India-specific tech/security topics (UPI, Aadhaar security, CERT-In, TRAI)
- off_topic: cooking, relationships, entertainment, general knowledge, creative writing, non-security finance, politics, sports — anything not tech or security
- unsafe: hacking specific targets without permission, creating malware, bypassing security for unauthorized access, social engineering attack instructions, CSAM, violence

Respond with ONLY ONE WORD: safe, off_topic, or unsafe`;

export async function classifyInput(
  message: string,
  apiKey: string
): Promise<InputClassification> {
  const classify = createChatCompletion(
    {
      messages: [
        { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
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
    const label = raw.toLowerCase().replace(/[^a-z_]/g, '');
    if (label === 'off_topic' || label === 'unsafe') return label;
    return 'safe';
  } catch (err) {
    // Fail open — a DeepSeek outage should not block legitimate users
    console.warn('classifyInput failed, defaulting to safe:', (err as Error).message);
    return 'safe';
  }
}

// ─── Layer 3a: Output PII Masking (regex, synchronous) ────────────────────────

const OUTPUT_PII_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[AADHAAR REDACTED]' },
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[CARD NUMBER REDACTED]' },
];

export function scanOutputForPII(text: string): string {
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
