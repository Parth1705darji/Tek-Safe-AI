import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { BreachCheckResult } from '../../src/types';

const HIBP_KEY = process.env.HIBP_API_KEY;

interface HIBPBreach {
  Name: string;
  Domain: string;
  BreachDate: string;
  DataClasses: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function generateAdvice(breaches: BreachCheckResult['breaches']): string {
  if (breaches.length === 0) {
    return 'Great news! Your email was not found in any known data breaches. Keep using strong unique passwords and enable 2FA on all your accounts.';
  }

  const hasPasswords = breaches.some((b) =>
    b.data_classes.some((d) => d.toLowerCase().includes('password'))
  );
  const currentYear = new Date().getFullYear();
  const hasRecent = breaches.some(
    (b) => new Date(b.breach_date).getFullYear() >= currentYear - 1
  );
  const services = breaches
    .slice(0, 3)
    .map((b) => b.name)
    .join(', ');
  const more = breaches.length > 3 ? ` and ${breaches.length - 3} more` : '';

  const lines: string[] = [];

  if (hasPasswords && hasRecent) {
    lines.push(
      `🚨 URGENT: Your email was found in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''} including recent ones where passwords were exposed. Change your passwords on ${services}${more} immediately.`
    );
  } else if (hasPasswords) {
    lines.push(
      `⚠️ Your email was found in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''} where passwords were exposed. Change passwords on ${services}${more}.`
    );
  } else {
    lines.push(
      `ℹ️ Your email appeared in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''}, but no passwords were directly exposed. Stay vigilant for phishing emails.`
    );
  }

  lines.push(
    'Recommended steps: (1) Change passwords on affected services. (2) Enable two-factor authentication (2FA) everywhere. (3) Use a password manager to create unique passwords for every site.'
  );

  if (breaches.length >= 5) {
    lines.push(
      'Given the high number of exposures, consider creating a new email address for sensitive accounts like banking and government services.'
    );
  }

  return lines.join(' ');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body as { email?: string; params?: string };
  const email = (body.email ?? body.params ?? '').trim();

  if (!email) {
    return res.status(400).json({ error: 'Please enter an email address.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!HIBP_KEY || HIBP_KEY === 'your_key_here') {
    return res.status(503).json({ error: 'Breach check is temporarily unavailable. Please try again later.' });
  }

  const doFetch = () =>
    fetchWithTimeout(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': HIBP_KEY,
          'User-Agent': 'Tek-Safe-AI/1.0',
        },
      }
    );

  try {
    let response = await doFetch();

    // Retry once on rate limit
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      response = await doFetch();
    }

    if (response.status === 429) {
      return res
        .status(429)
        .json({ error: "We're checking too many requests right now. Please try again in a minute." });
    }

    // 404 = clean email
    if (response.status === 404) {
      const result: BreachCheckResult = {
        email,
        breached: false,
        breach_count: 0,
        breaches: [],
        advice: generateAdvice([]),
      };
      return res.json(result);
    }

    if (!response.ok) {
      throw new Error(`HIBP error ${response.status}`);
    }

    const data = (await response.json()) as HIBPBreach[];
    const breaches = data.map((b) => ({
      name: b.Name,
      domain: b.Domain,
      breach_date: b.BreachDate,
      data_classes: b.DataClasses,
    }));

    const result: BreachCheckResult = {
      email,
      breached: true,
      breach_count: breaches.length,
      breaches,
      advice: generateAdvice(breaches),
    };

    return res.json(result);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return res.status(408).json({ error: 'The scan is taking longer than expected. Please try again.' });
    }
    console.error('Breach check error:', e);
    return res.status(500).json({ error: 'Unable to connect to the scanning service. Check your internet connection.' });
  }
}
