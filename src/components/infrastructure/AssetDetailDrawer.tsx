import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { X, Loader2, CheckCircle2, AlertTriangle, MessageSquare, Globe } from 'lucide-react';
import SecurityScoreBadge from './SecurityScoreBadge';
import type { NetworkAsset, AssetVulnerability } from '../../types';

// Well-known port → service name
const PORT_NAMES: Record<number, string> = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 161: 'SNMP', 389: 'LDAP',
  443: 'HTTPS', 445: 'SMB', 587: 'SMTP-TLS', 636: 'LDAPS',
  1433: 'MSSQL', 1521: 'Oracle', 3306: 'MySQL', 3389: 'RDP',
  5432: 'Postgres', 5900: 'VNC', 6379: 'Redis', 8080: 'HTTP-Alt',
  8443: 'HTTPS-Alt', 27017: 'MongoDB',
};
const RISKY_PORTS = new Set([21, 23, 135, 137, 139, 445, 1433, 1521, 3306, 3389, 5900, 6379, 27017]);

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-700/40',
  high:     'bg-orange-500/20 text-orange-400 border-orange-700/40',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-700/40',
  low:      'bg-blue-500/20 text-blue-400 border-blue-700/40',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

interface AssetDetailDrawerProps {
  asset: NetworkAsset | null;
  onClose: () => void;
  onAskAI: (asset: NetworkAsset) => void;
}

const AssetDetailDrawer = ({ asset, onClose, onAskAI }: AssetDetailDrawerProps) => {
  const { getToken } = useAuth();
  const [vulns, setVulns] = useState<AssetVulnerability[]>([]);
  const [loadingVulns, setLoadingVulns] = useState(false);

  useEffect(() => {
    if (!asset) { setVulns([]); return; }
    // Skip fetch for demo assets
    if (asset.agent_id === 'demo') return;

    let cancelled = false;
    setLoadingVulns(true);
    getToken().then(async (token) => {
      try {
        const res = await fetch(`/api/infrastructure/asset?id=${asset.id}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { vulnerabilities?: AssetVulnerability[] };
        if (!cancelled) setVulns(data.vulnerabilities ?? []);
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setLoadingVulns(false); }
    });
    return () => { cancelled = true; };
  }, [asset, getToken]);

  if (!asset) return null;

  const online = isOnline(asset.last_seen);
  const osLabel = [asset.os_name, asset.os_version].filter(Boolean).join(' ') || 'Unknown';
  const sortedVulns = [...vulns].sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-gray-800 bg-gray-900 shadow-2xl transition-transform duration-300">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">{asset.hostname ?? asset.ip_address}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className={`text-xs ${online ? 'text-green-400' : 'text-red-400'}`}>{online ? 'Online' : 'Offline'}</span>
              <span className="text-xs text-gray-500 capitalize">{asset.device_type}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">

          {/* Section 1 — Details */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Details</p>
            <div className="space-y-1.5 rounded-xl border border-gray-800 bg-gray-800/40 p-3">
              <Row label="IP Address"    value={asset.ip_address} />
              {asset.hostname && <Row label="Hostname"     value={asset.hostname} />}
              <Row label="OS"            value={osLabel} />
              {asset.vendor && <Row label="Vendor"       value={asset.vendor} />}
              {asset.mac_address && <Row label="MAC"     value={asset.mac_address} />}
              <Row label="First Seen"    value={formatDate(asset.first_seen)} />
              <Row label="Last Seen"     value={formatDate(asset.last_seen)} />
              <Row
                label="Internet Facing"
                value={
                  asset.is_internet_facing
                    ? <span className="flex items-center gap-1 text-orange-400"><Globe className="h-3 w-3" />Yes</span>
                    : <span className="text-gray-400">No</span>
                }
              />
            </div>
          </section>

          {/* Section 2 — Open Ports */}
          {asset.open_ports.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Open Ports
              </p>
              <div className="flex flex-wrap gap-1.5">
                {asset.open_ports.map((port) => {
                  const risky = RISKY_PORTS.has(port);
                  const name  = PORT_NAMES[port];
                  return (
                    <span
                      key={port}
                      className={[
                        'rounded-lg border px-2 py-0.5 text-xs font-mono font-medium',
                        risky
                          ? 'border-red-700/50 bg-red-900/20 text-red-400'
                          : 'border-gray-700 bg-gray-800 text-gray-300',
                      ].join(' ')}
                      title={risky ? 'Potentially risky port' : undefined}
                    >
                      {port}{name ? ` ${name}` : ''}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 3 — Security Score */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Security Score
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-800/40 p-3">
              {asset.security_score != null
                ? <SecurityScoreBadge score={asset.security_score} />
                : <span className="text-gray-500">—</span>}
              <span className={`text-sm font-medium capitalize ${
                asset.risk_level === 'critical' ? 'text-red-400'
                : asset.risk_level === 'high'   ? 'text-orange-400'
                : asset.risk_level === 'medium' ? 'text-yellow-400'
                : 'text-[#00D4AA]'
              }`}>
                {asset.risk_level} risk
              </span>
            </div>
          </section>

          {/* Section 4 — CVE Findings */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              CVE Findings
              {loadingVulns && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </p>
            {loadingVulns ? null
              : sortedVulns.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-green-800/40 bg-green-900/10 px-3 py-2.5 text-xs text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No vulnerabilities found
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedVulns.map((v) => (
                    <div key={v.id} className={`rounded-xl border p-3 ${SEVERITY_COLORS[v.severity] ?? SEVERITY_COLORS.low}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold">{v.cve_id}</span>
                        <div className="flex items-center gap-1.5">
                          {v.cvss_score != null && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-black/20 font-semibold">
                              CVSS {v.cvss_score.toFixed(1)}
                            </span>
                          )}
                          <span className="rounded px-1.5 py-0.5 text-xs font-semibold capitalize bg-black/20">
                            {v.severity}
                          </span>
                        </div>
                      </div>
                      {v.description && (
                        <p className="text-xs opacity-80 line-clamp-2">{v.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            {asset.cve_count > 0 && sortedVulns.length === 0 && !loadingVulns && asset.agent_id !== 'demo' && (
              <div className="flex items-center gap-2 rounded-xl border border-yellow-800/40 bg-yellow-900/10 px-3 py-2.5 text-xs text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {asset.cve_count} CVE(s) recorded — CVE details loading
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-5 py-4">
          <button
            onClick={() => { onClose(); onAskAI(asset); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2.5 text-sm font-medium text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/20"
          >
            <MessageSquare className="h-4 w-4" />
            Ask AI about this device
          </button>
        </div>
      </div>
    </>
  );
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-200">{value}</span>
    </div>
  );
}

export default AssetDetailDrawer;
