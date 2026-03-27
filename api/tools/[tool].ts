/**
 * Unified security tool handler.
 * Route: /api/tools/[tool]  (breach-check | url-scan | ip-check)
 *
 * Consolidated from three individual files to stay within Vercel Hobby plan's
 * 12-serverless-function limit.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { BreachCheckResult, UrlScanResult, IpCheckResult } from '../../src/types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Breach Check ─────────────────────────────────────────────────────────────

interface HIBPBreach {
  Name: string;
  Domain: string;
  BreachDate: string;
  DataClasses: string[];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateBreachAdvice(breaches: BreachCheckResult['breaches']): string {
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
  const services = breaches.slice(0, 3).map((b) => b.name).join(', ');
  const more = breaches.length > 3 ? ` and ${breaches.length - 3} more` : '';
  const lines: string[] = [];
  if (hasPasswords && hasRecent) {
    lines.push(`🚨 URGENT: Your email was found in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''} including recent ones where passwords were exposed. Change your passwords on ${services}${more} immediately.`);
  } else if (hasPasswords) {
    lines.push(`⚠️ Your email was found in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''} where passwords were exposed. Change passwords on ${services}${more}.`);
  } else {
    lines.push(`ℹ️ Your email appeared in ${breaches.length} breach${breaches.length > 1 ? 'es' : ''}, but no passwords were directly exposed. Stay vigilant for phishing emails.`);
  }
  lines.push('Recommended steps: (1) Change passwords on affected services. (2) Enable two-factor authentication (2FA) everywhere. (3) Use a password manager to create unique passwords for every site.');
  if (breaches.length >= 5) {
    lines.push('Given the high number of exposures, consider creating a new email address for sensitive accounts like banking and government services.');
  }
  return lines.join(' ');
}

async function handleBreachCheck(req: VercelRequest, res: VercelResponse): Promise<void> {
  const HIBP_KEY = process.env.HIBP_API_KEY;
  const body = req.body as { email?: string; params?: string };
  const email = (body.email ?? body.params ?? '').trim();

  if (!email) { res.status(400).json({ error: 'Please enter an email address.' }); return; }
  if (!isValidEmail(email)) { res.status(400).json({ error: 'Please enter a valid email address.' }); return; }
  if (!HIBP_KEY || HIBP_KEY === 'your_key_here') { res.status(503).json({ error: 'Breach check is temporarily unavailable. Please try again later.' }); return; }

  const doFetch = () =>
    fetchWithTimeout(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      { headers: { 'hibp-api-key': HIBP_KEY, 'User-Agent': 'Tek-Safe-AI/1.0' } }
    );

  try {
    let response = await doFetch();
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      response = await doFetch();
    }
    if (response.status === 429) { res.status(429).json({ error: "We're checking too many requests right now. Please try again in a minute." }); return; }
    if (response.status === 404) {
      res.json({ email, breached: false, breach_count: 0, breaches: [], advice: generateBreachAdvice([]) } as BreachCheckResult);
      return;
    }
    if (!response.ok) throw new Error(`HIBP error ${response.status}`);
    const data = (await response.json()) as HIBPBreach[];
    const breaches = data.map((b) => ({ name: b.Name, domain: b.Domain, breach_date: b.BreachDate, data_classes: b.DataClasses }));
    res.json({ email, breached: true, breach_count: breaches.length, breaches, advice: generateBreachAdvice(breaches) } as BreachCheckResult);
  } catch (e) {
    if ((e as Error).name === 'AbortError') { res.status(408).json({ error: 'The scan is taking longer than expected. Please try again.' }); return; }
    console.error('Breach check error:', e);
    res.status(500).json({ error: 'Unable to connect to the scanning service. Check your internet connection.' });
  }
}

// ─── URL Scan ─────────────────────────────────────────────────────────────────

interface VTStats { malicious: number; suspicious: number; harmless: number; undetected: number; }
interface VTResponse { data: { attributes: { status?: string; stats: VTStats; last_final_url?: string; title?: string; } } }

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

function heuristicCheck(url: string): { level: 'warn' | 'info'; message: string }[] {
  const warnings: { level: 'warn' | 'info'; message: string }[] = [];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:') warnings.push({ level: 'warn', message: 'Site does not use HTTPS — data may be sent unencrypted.' });
    if (host.split('.').length - 2 >= 3) warnings.push({ level: 'warn', message: 'Unusually many subdomains — a common phishing technique.' });
    for (const [pattern, brand] of BRAND_TYPOS) {
      if (pattern.test(host)) { warnings.push({ level: 'warn', message: `Domain looks like it's impersonating "${brand}" — potential phishing site.` }); break; }
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) warnings.push({ level: 'warn', message: 'URL uses a raw IP address instead of a domain name — suspicious.' });
    if (url.length > 200) warnings.push({ level: 'info', message: 'Unusually long URL — verify before clicking.' });
  } catch { /* invalid URL caught earlier */ }
  return warnings;
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

function generateUrlAdvice(verdict: string, positives: number, total: number, warnings: { level: string }[]): string {
  const lines: string[] = [];
  if (verdict === 'malicious') {
    lines.push(`🚨 WARNING: This URL was flagged as malicious by ${positives} out of ${total} security scanners. Do NOT visit this site or enter any personal information.`);
    lines.push('If you already visited it: change passwords for any accounts you logged into, and run a malware scan on your device.');
  } else if (verdict === 'suspicious') {
    lines.push(`⚠️ CAUTION: This URL raised flags with ${positives} out of ${total} security scanners. Proceed with extreme caution.`);
    lines.push('Avoid entering passwords, payment details, or personal information on this site.');
  } else {
    lines.push(`✅ This URL appears safe — no security engines flagged it as malicious (${total} scanners checked).`);
    lines.push(warnings.length > 0 ? 'However, some local checks found potential concerns (see below).' : 'Still, only visit sites from trusted sources and never enter personal information on unexpected pages.');
  }
  return lines.join(' ');
}

async function handleUrlScan(req: VercelRequest, res: VercelResponse): Promise<void> {
  const VT_KEY = process.env.VIRUSTOTAL_API_KEY;
  const body = req.body as { url?: string; params?: string };
  const url = (body.url ?? body.params ?? '').trim();

  const isValidUrl = (u: string) => { try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; } };

  if (!url) { res.status(400).json({ error: 'Please enter a URL to scan.' }); return; }
  if (!isValidUrl(url)) { res.status(400).json({ error: 'Please enter a valid URL starting with http:// or https://' }); return; }
  if (!VT_KEY || VT_KEY === 'your_key_here') { res.status(503).json({ error: 'URL scanner is temporarily unavailable. Please try again later.' }); return; }

  const warnings = heuristicCheck(url);

  try {
    let vtData: VTResponse | null = null;
    const urlId = urlToVtId(url);
    const getRes = await fetchWithTimeout(`https://www.virustotal.com/api/v3/urls/${urlId}`, { headers: { 'x-apikey': VT_KEY } });

    if (getRes.ok) {
      vtData = (await getRes.json()) as VTResponse;
    } else {
      const submitRes = await fetchWithTimeout('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: { 'x-apikey': VT_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`,
      });
      if (submitRes.status === 429) { res.status(429).json({ error: "We're checking too many requests right now. Please try again in a minute." }); return; }
      if (!submitRes.ok) throw new Error(`VT submit error ${submitRes.status}`);
      const submitted = (await submitRes.json()) as { data: { id: string } };
      await new Promise((r) => setTimeout(r, 3000));
      const analysisRes = await fetchWithTimeout(`https://www.virustotal.com/api/v3/analyses/${submitted.data.id}`, { headers: { 'x-apikey': VT_KEY } });
      if (analysisRes.ok) vtData = (await analysisRes.json()) as VTResponse;
    }

    const stats: VTStats = vtData?.data?.attributes?.stats ?? { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 };
    const total = Math.max(stats.malicious + stats.suspicious + stats.harmless + stats.undetected, 1);
    const heuristicPositives = warnings.filter((w) => w.level === 'warn').length;
    const verdict = deriveVerdict(stats, heuristicPositives > 0 && stats.malicious === 0 && stats.suspicious === 0 ? heuristicPositives : undefined);
    const positives = stats.malicious + stats.suspicious;

    res.json({
      url, verdict, positives, total_scanners: total,
      details: { stats, heuristic_warnings: warnings, final_url: vtData?.data?.attributes?.last_final_url ?? url, page_title: vtData?.data?.attributes?.title ?? null },
      advice: generateUrlAdvice(verdict, positives, total, warnings),
    } as UrlScanResult);
  } catch (e) {
    if ((e as Error).name === 'AbortError') { res.status(408).json({ error: 'The scan is taking longer than expected. Please try again.' }); return; }
    console.error('URL scan error:', e);
    res.status(500).json({ error: 'Unable to connect to the scanning service. Check your internet connection.' });
  }
}

// ─── IP Check ─────────────────────────────────────────────────────────────────

interface AbuseIPDBData {
  ipAddress: string; abuseConfidenceScore: number; countryCode: string; countryName: string;
  isp: string; usageType: string; domain: string; isTor: boolean;
  totalReports: number; numDistinctUsers: number; lastReportedAt: string | null;
  reports?: Array<{ categories: number[] }>;
}

const CATEGORY_MAP: Record<number, string> = {
  3: 'Fraud Orders', 4: 'DDoS Attack', 5: 'FTP Brute-Force', 6: 'Ping of Death',
  7: 'Email Spam', 8: 'VoIP Fraud', 9: 'Open Proxy', 10: 'Web Spam', 11: 'Email Spam',
  14: 'Port Scan', 15: 'Hacking', 16: 'SQL Injection', 17: 'Spoofing', 18: 'Brute Force',
  19: 'Bad Web Bot', 20: 'Exploited Host', 21: 'Web App Attack', 22: 'SSH Brute Force', 23: 'IoT Targeted',
};

function isValidIp(ip: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').every((n) => parseInt(n) <= 255);
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

function toRiskLevel(score: number): IpCheckResult['risk_level'] {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

function generateIpAdvice(data: AbuseIPDBData, riskLevel: string, categories: string[]): string {
  const { abuseConfidenceScore, totalReports, isTor } = data;
  const lines: string[] = [];
  if (riskLevel === 'critical') {
    lines.push(`🚨 CRITICAL RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports.toLocaleString()} reports.`);
    if (isTor) lines.push('It is a Tor exit node, commonly used to anonymise malicious activity.');
    if (categories.length > 0) lines.push(`Reported for: ${categories.join(', ')}.`);
    lines.push('Block this IP immediately if it is accessing your systems or applications.');
  } else if (riskLevel === 'high') {
    lines.push(`⚠️ HIGH RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports.toLocaleString()} reports.`);
    if (categories.length > 0) lines.push(`Reported for: ${categories.join(', ')}.`);
    lines.push('Consider blocking or monitoring this IP closely.');
  } else if (riskLevel === 'medium') {
    lines.push(`⚠️ MEDIUM RISK: This IP has an abuse score of ${abuseConfidenceScore}/100 with ${totalReports} report${totalReports !== 1 ? 's' : ''}.`);
    lines.push('Exercise caution if this IP is initiating connections to your systems.');
  } else {
    lines.push(`✅ LOW RISK: This IP has an abuse score of only ${abuseConfidenceScore}/100 with ${totalReports} report${totalReports !== 1 ? 's' : ''}.`);
    lines.push('No significant malicious activity has been reported for this IP recently.');
  }
  return lines.join(' ');
}

async function handleIpCheck(req: VercelRequest, res: VercelResponse): Promise<void> {
  const ABUSE_KEY = process.env.ABUSEIPDB_API_KEY;
  const body = req.body as { ip?: string; params?: string };
  const ip = (body.ip ?? body.params ?? '').trim();

  if (!ip) { res.status(400).json({ error: 'Please enter an IP address.' }); return; }
  if (!isValidIp(ip)) { res.status(400).json({ error: 'Please enter a valid IPv4 or IPv6 address.' }); return; }
  if (isPrivateIp(ip)) { res.status(400).json({ error: 'Private and reserved IP addresses cannot be checked.' }); return; }
  if (!ABUSE_KEY || ABUSE_KEY === 'your_key_here') { res.status(503).json({ error: 'IP checker is temporarily unavailable. Please try again later.' }); return; }

  try {
    const response = await fetchWithTimeout(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
      { headers: { Key: ABUSE_KEY, Accept: 'application/json' } }
    );
    if (response.status === 429) { res.status(429).json({ error: "We're checking too many requests right now. Please try again in a minute." }); return; }
    if (response.status === 422) { res.status(400).json({ error: 'Please enter a valid IPv4 or IPv6 address.' }); return; }
    if (!response.ok) throw new Error(`AbuseIPDB error ${response.status}`);

    const d = ((await response.json()) as { data: AbuseIPDBData }).data;
    const riskLevel = toRiskLevel(d.abuseConfidenceScore);
    const categories = d.reports
      ? [...new Set(d.reports.flatMap((r) => r.categories.map((c) => CATEGORY_MAP[c]).filter(Boolean)))].slice(0, 6)
      : [];

    res.json({
      ip: d.ipAddress, abuse_score: d.abuseConfidenceScore, risk_level: riskLevel,
      country: d.countryName || d.countryCode, isp: d.isp,
      usage_type: d.usageType || undefined, domain: d.domain || undefined,
      is_tor: d.isTor, total_reports: d.totalReports, last_reported: d.lastReportedAt,
      categories: categories.length > 0 ? categories : undefined,
      advice: generateIpAdvice(d, riskLevel, categories),
    } as IpCheckResult);
  } catch (e) {
    if ((e as Error).name === 'AbortError') { res.status(408).json({ error: 'The check is taking longer than expected. Please try again.' }); return; }
    console.error('IP check error:', e);
    res.status(500).json({ error: 'Unable to connect to the checking service. Check your internet connection.' });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const tool = req.query.tool as string;

  if (tool === 'breach-check') return handleBreachCheck(req, res);
  if (tool === 'url-scan') return handleUrlScan(req, res);
  if (tool === 'ip-check') return handleIpCheck(req, res);

  return res.status(404).json({ error: `Unknown tool: ${tool}` });
}
