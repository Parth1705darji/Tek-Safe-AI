/**
 * Security score calculation for network assets.
 * Penalty-based system: starts at 100, deducts for CVEs, risky ports, EOL OS.
 */

// ── EOL OS definitions ────────────────────────────────────────────────────────
const EOL_OS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /windows\s*xp/i,                label: 'Windows XP' },
  { pattern: /windows\s*(vista|7)/i,          label: 'Windows 7/Vista' },
  { pattern: /windows\s*8(\s|$|\.)/i,         label: 'Windows 8' },
  { pattern: /windows\s*server\s*200[038]/i,  label: 'Windows Server 2003/2008' },
  { pattern: /windows\s*server\s*2012/i,      label: 'Windows Server 2012' },
  { pattern: /ubuntu\s*(14|16|18|19|21)\.04/i,label: 'Ubuntu 14-21.04' },
  { pattern: /ubuntu\s*20\.10/i,              label: 'Ubuntu 20.10' },
  { pattern: /centos\s*(6|7|8)(\s|$)/i,       label: 'CentOS 6/7/8' },
  { pattern: /debian\s*([1-9]|10)(\s|$)/i,    label: 'Debian ≤10' },
  { pattern: /rhel\s*[1-7](\s|$)/i,           label: 'RHEL ≤7' },
  { pattern: /pan[- ]?os\s*([1-9]|10\.0)/i,   label: 'PAN-OS ≤10.0' },
  { pattern: /ios[- ]?xe\s*1[0-5]\./i,        label: 'IOS-XE ≤15.x' },
  { pattern: /postgresql\s*(9|10|11|12|13)/i, label: 'PostgreSQL ≤13' },
];

// ── Risky port definitions ────────────────────────────────────────────────────
const RISKY_PORTS: Record<number, number> = {
  21:   15, // FTP (cleartext)
  23:   20, // Telnet (cleartext)
  135:   8, // MS-RPC
  137:   8, // NetBIOS
  139:   8, // NetBIOS Session
  445:  12, // SMB — ransomware vector
  1433:  8, // MSSQL
  1521:  8, // Oracle DB
  3306:  8, // MySQL exposed
  3389: 12, // RDP
  5900:  8, // VNC
  6379:  8, // Redis (often unauthenticated)
  27017: 8, // MongoDB (often unauthenticated)
};

export interface ScoringInput {
  open_ports: number[];
  os_name: string | null;
  os_version: string | null;
  is_internet_facing: boolean;
  cve_count: number;
  vulns?: Array<{ severity: string }>;
}

export function calculateSecurityScore(asset: ScoringInput): {
  score: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
} {
  let score = 100;

  // ── CVE penalties ─────────────────────────────────────────────────────────
  const vulns = asset.vulns ?? [];
  for (const v of vulns) {
    switch (v.severity) {
      case 'critical': score -= 20; break;
      case 'high':     score -= 10; break;
      case 'medium':   score -=  5; break;
      case 'low':      score -=  2; break;
    }
  }
  // If only cve_count available (no detailed vulns list), estimate
  if (vulns.length === 0 && asset.cve_count > 0) {
    score -= asset.cve_count * 8;
  }

  // ── EOL OS penalty ────────────────────────────────────────────────────────
  const osString = [asset.os_name, asset.os_version].filter(Boolean).join(' ');
  if (osString) {
    for (const eol of EOL_OS) {
      if (eol.pattern.test(osString)) {
        score -= 20;
        break;
      }
    }
  }

  // ── Risky ports penalty ───────────────────────────────────────────────────
  let portPenalty = 0;
  for (const port of asset.open_ports) {
    if (RISKY_PORTS[port]) portPenalty += RISKY_PORTS[port];
  }
  score -= Math.min(portPenalty, 30); // cap port penalty at 30

  // ── Internet-facing penalty ───────────────────────────────────────────────
  if (asset.is_internet_facing) score -= 5;

  // ── Clamp ────────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  const risk_level: 'critical' | 'high' | 'medium' | 'low' =
    score >= 80 ? 'low'
    : score >= 60 ? 'medium'
    : score >= 40 ? 'high'
    : 'critical';

  return { score, risk_level };
}
