import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IpCheckResult } from '../../src/types';

const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY;

interface AbuseIPDBData {
  ipAddress: string;
  abuseConfidenceScore: number;
  countryCode: string;
  countryName: string;
  isp: string;
  usageType: string;
  domain: string;
  isTor: boolean;
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt: string | null;
  reports?: Array<{ categories: number[] }>;
}

interface AbuseIPDBResponse {
  data: AbuseIPDBData;
}

// AbuseIPDB category codes → human-readable labels
const CATEGORY_MAP: Record<number, string> = {
  3: 'Fraud Orders',
  4: 'DDoS Attack',
  5: 'FTP Brute-Force',
  6: 'Ping of Death',
  7: 'Email Spam',
  8: 'VoIP Fraud',
  9: 'Open Proxy',
  10: 'Web Spam',
  11: 'Email Spam',
  14: 'Port Scan',
  15: 'Hacking',
  16: 'SQL Injection',
  17: 'Spoofing',
  18: 'Brute Force',
  19: 'Bad Web Bot',
  20: 'Exploited Host',
  21: 'Web App Attack',
  22: 'SSH Brute Force',
  23: 'IoT Targeted',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidIp(ip: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip.split('.').every((n) => parseInt(n) <= 255);
  }
  // IPv6
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) // link-local
  );
}

function toRiskLevel(score: number): IpCheckResult['risk_level'] {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

function extractCategories(reports: Array<{ categories: number[] }>): string[] {
  const seen = new Set<string>();
  for (const r of reports) {
    for (const code of r.categories) {
      const label = CATEGORY_MAP[code];
      if (label) seen.add(label);
    }
  }
  return [...seen].slice(0, 6);
}

function generateAdvice(data: AbuseIPDBData, riskLevel: string, categories: string[]): string {
  const { abuseConfidenceScore, totalReports, isTor } = data;
  const lines: string[] = [];

  if (riskLevel === 'critical') {
    lines.push(
      `🚨 CRITICAL RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports.toLocaleString()} reports.`
    );
    if (isTor) lines.push('It is a Tor exit node, commonly used to anonymise malicious activity.');
    if (categories.length > 0) lines.push(`Reported for: ${categories.join(', ')}.`);
    lines.push('Block this IP immediately if it is accessing your systems or applications.');
  } else if (riskLevel === 'high') {
    lines.push(
      `⚠️ HIGH RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports.toLocaleString()} reports.`
    );
    if (categories.length > 0) lines.push(`Reported for: ${categories.join(', ')}.`);
    lines.push('Consider blocking or monitoring this IP closely.');
  } else if (riskLevel === 'medium') {
    lines.push(
      `⚠️ MEDIUM RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports} report${totalReports !== 1 ? 's' : ''}.`
    );
    lines.push('Exercise caution if this IP is initiating connections to your systems.');
  } else {
    lines.push(
      `✅ LOW RISK: This IP has an abuse score of only ${abuseConfidenceScore}/100 with ${totalReports} report${totalReports !== 1 ? 's' : ''}.`
    );
    lines.push('No significant malicious activity has been reported for this IP recently.');
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

  const body = req.body as { ip?: string; params?: string };
  const ip = (body.ip ?? body.params ?? '').trim();

  if (!ip) {
    return res.status(400).json({ error: 'Please enter an IP address.' });
  }
  if (!isValidIp(ip)) {
    return res.status(400).json({ error: 'Please enter a valid IPv4 or IPv6 address.' });
  }
  if (isPrivateIp(ip)) {
    return res.status(400).json({ error: 'Private and reserved IP addresses cannot be checked.' });
  }
  if (!ABUSE_KEY || ABUSE_KEY === 'your_key_here') {
    return res.status(503).json({ error: 'IP checker is temporarily unavailable. Please try again later.' });
  }

  try {
    const response = await fetchWithTimeout(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
      {
        headers: {
          Key: ABUSE_KEY,
          Accept: 'application/json',
        },
      }
    );

    if (response.status === 429) {
      return res.status(429).json({ error: "We're checking too many requests right now. Please try again in a minute." });
    }
    if (response.status === 422) {
      return res.status(400).json({ error: 'Please enter a valid IPv4 or IPv6 address.' });
    }
    if (!response.ok) {
      throw new Error(`AbuseIPDB error ${response.status}`);
    }

    const json = (await response.json()) as AbuseIPDBResponse;
    const d = json.data;
    const riskLevel = toRiskLevel(d.abuseConfidenceScore);
    const categories = d.reports ? extractCategories(d.reports) : [];

    const result: IpCheckResult = {
      ip: d.ipAddress,
      abuse_score: d.abuseConfidenceScore,
      risk_level: riskLevel,
      country: d.countryName || d.countryCode,
      isp: d.isp,
      usage_type: d.usageType || undefined,
      domain: d.domain || undefined,
      is_tor: d.isTor,
      total_reports: d.totalReports,
      last_reported: d.lastReportedAt,
      categories: categories.length > 0 ? categories : undefined,
      advice: generateAdvice(d, riskLevel, categories),
    };

    return res.json(result);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return res.status(408).json({ error: 'The check is taking longer than expected. Please try again.' });
    }
    console.error('IP check error:', e);
    return res.status(500).json({ error: 'Unable to connect to the checking service. Check your internet connection.' });
  }
}
