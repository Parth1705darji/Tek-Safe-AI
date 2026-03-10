import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UrlScanResult } from '../../src/types';

const VT_KEY = process.env.VIRUSTOTAL_API_KEY;

interface VTStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
}

interface VTResponse {
  data: {
    attributes: {
      status?: string;
      stats: VTStats;
      last_final_url?: string;
      title?: string;
    };
  };
}

// ─── Heuristic checks (fast, no API) ─────────────────────────────────────────

const BRAND_TYPOS: [RegExp, string][] = [
  [/paypa[l1][^.]*\.(?!com$)/, 'paypal'],
  [/g[o0]{2}g[l1]e[^.]*\.(?!com$)/, 'google'],
  [/faceb[o0]{2}k[^.]*\.(?!com$)/, 'facebook'],
  [/micr[o0]s[o0]ft[^.]*\.(?!com$)/, 'microsoft'],
  [/app[l1]e[^.]*\.(?!com$)/, 'apple'],
  [/amaz[o0]n[^.]*\.(?!com$)/, 'amazon'],
  [/netfl[i1]x[^.]*\.(?!com$)/, 'netflix'],
  [/[io]nstagram[^.]*\.(?!com$)/, 'instagram'],
  [/wh?atsapp[^.]*\.(?!net$|com$)/, 'whatsapp'],
  [/sbi[^.]*\.(?!co\.in$|com$)/, 'sbi'],
  [/hdfc[^.]*\.(?!com$)/, 'hdfc'],
  [/icicib?ank[^.]*\.(?!com$)/, 'icicibank'],
];

interface HeuristicWarning {
  level: 'warn' | 'info';
  message: string;
}

function heuristicCheck(url: string): HeuristicWarning[] {
  const warnings: HeuristicWarning[] = [];

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const subdomains = host.split('.').length - 2;

    // No HTTPS
    if (parsed.protocol !== 'https:') {
      warnings.push({ level: 'warn', message: 'Site does not use HTTPS — data may be sent unencrypted.' });
    }

    // Excessive subdomains (phishing technique)
    if (subdomains >= 3) {
      warnings.push({ level: 'warn', message: 'Unusually many subdomains — a common phishing technique.' });
    }

    // Brand typosquatting
    for (const [pattern, brand] of BRAND_TYPOS) {
      if (pattern.test(host)) {
        warnings.push({
          level: 'warn',
          message: `Domain looks like it's impersonating "${brand}" — potential phishing site.`,
        });
        break;
      }
    }

    // IP address as hostname
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      warnings.push({ level: 'warn', message: 'URL uses a raw IP address instead of a domain name — suspicious.' });
    }

    // Very long URL path (often obfuscation)
    if (url.length > 200) {
      warnings.push({ level: 'info', message: 'Unusually long URL — verify before clicking.' });
    }
  } catch {
    // Invalid URL — caught earlier in validation
  }

  return warnings;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function urlToVtId(url: string): string {
  return Buffer.from(url).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function deriveVerdict(stats: VTStats, positiveOverride?: number): 'safe' | 'suspicious' | 'malicious' {
  const pos = positiveOverride ?? stats.malicious + stats.suspicious;
  if (stats.malicious >= 4 || pos >= 4) return 'malicious';
  if (stats.malicious > 0 || stats.suspicious > 0 || pos > 0) return 'suspicious';
  return 'safe';
}

function generateAdvice(verdict: string, positives: number, total: number, warnings: HeuristicWarning[]): string {
  const lines: string[] = [];

  if (verdict === 'malicious') {
    lines.push(
      `🚨 WARNING: This URL was flagged as malicious by ${positives} out of ${total} security scanners. Do NOT visit this site or enter any personal information.`
    );
    lines.push('If you already visited it: change passwords for any accounts you logged into, and run a malware scan on your device.');
  } else if (verdict === 'suspicious') {
    lines.push(
      `⚠️ CAUTION: This URL raised flags with ${positives} out of ${total} security scanners. Proceed with extreme caution.`
    );
    lines.push('Avoid entering passwords, payment details, or personal information on this site.');
  } else {
    lines.push(`✅ This URL appears safe — no security engines flagged it as malicious (${total} scanners checked).`);
    if (warnings.length > 0) {
      lines.push('However, some local checks found potential concerns (see below).');
    } else {
      lines.push('Still, only visit sites from trusted sources and never enter personal information on unexpected pages.');
    }
  }

  return lines.join(' ');
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body as { url?: string; params?: string };
  const url = (body.url ?? body.params ?? '').trim();

  if (!url) {
    return res.status(400).json({ error: 'Please enter a URL to scan.' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL starting with http:// or https://' });
  }
  if (!VT_KEY || VT_KEY === 'your_key_here') {
    return res.status(503).json({ error: 'URL scanner is temporarily unavailable. Please try again later.' });
  }

  // Run heuristics instantly (no API needed)
  const warnings = heuristicCheck(url);

  try {
    let vtData: VTResponse | null = null;

    // 1. Try existing report first (faster)
    const urlId = urlToVtId(url);
    const getRes = await fetchWithTimeout(
      `https://www.virustotal.com/api/v3/urls/${urlId}`,
      { headers: { 'x-apikey': VT_KEY } }
    );

    if (getRes.ok) {
      vtData = (await getRes.json()) as VTResponse;
    } else {
      // 2. Submit URL for fresh scan
      const submitRes = await fetchWithTimeout(
        'https://www.virustotal.com/api/v3/urls',
        {
          method: 'POST',
          headers: {
            'x-apikey': VT_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `url=${encodeURIComponent(url)}`,
        }
      );

      if (submitRes.status === 429) {
        return res.status(429).json({ error: "We're checking too many requests right now. Please try again in a minute." });
      }

      if (!submitRes.ok) {
        throw new Error(`VT submit error ${submitRes.status}`);
      }

      const submitted = (await submitRes.json()) as { data: { id: string } };
      const analysisId = submitted.data.id;

      // 3. Wait 3s then fetch analysis
      await new Promise((r) => setTimeout(r, 3000));

      const analysisRes = await fetchWithTimeout(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        { headers: { 'x-apikey': VT_KEY } }
      );

      if (analysisRes.ok) {
        vtData = (await analysisRes.json()) as VTResponse;
      }
    }

    const stats: VTStats = vtData?.data?.attributes?.stats ?? {
      malicious: 0,
      suspicious: 0,
      harmless: 0,
      undetected: 0,
    };

    const total = Math.max(stats.malicious + stats.suspicious + stats.harmless + stats.undetected, 1);
    // Heuristic warnings bump verdict to at least suspicious if VT says safe
    const heuristicPositives = warnings.filter((w) => w.level === 'warn').length;
    const verdict = deriveVerdict(stats, heuristicPositives > 0 && stats.malicious === 0 && stats.suspicious === 0 ? heuristicPositives : undefined);

    const positives = stats.malicious + stats.suspicious;

    const result: UrlScanResult = {
      url,
      verdict,
      positives,
      total_scanners: total,
      details: {
        stats,
        heuristic_warnings: warnings,
        final_url: vtData?.data?.attributes?.last_final_url ?? url,
        page_title: vtData?.data?.attributes?.title ?? null,
      },
      advice: generateAdvice(verdict, positives, total, warnings),
    };

    return res.json(result);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return res.status(408).json({ error: 'The scan is taking longer than expected. Please try again.' });
    }
    console.error('URL scan error:', e);
    return res.status(500).json({ error: 'Unable to connect to the scanning service. Check your internet connection.' });
  }
}
