import { useState } from 'react';
import { Shield, Link2, Globe, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BreachCheckResult, UrlScanResult, IpCheckResult } from '../../types';

type ToolCardProps =
  | { tool: 'breach_check'; result: BreachCheckResult }
  | { tool: 'url_scan'; result: UrlScanResult }
  | { tool: 'ip_check'; result: IpCheckResult };

// ─── Advice block (shared) ────────────────────────────────────────────────────

function AdviceBlock({ advice }: { advice: string }) {
  return (
    <p className="mt-3 border-t border-gray-200/60 pt-3 text-xs leading-relaxed text-gray-600 dark:border-gray-700/60 dark:text-gray-400">
      {advice}
    </p>
  );
}

// ─── Breach Check ────────────────────────────────────────────────────────────

function BreachCard({ result }: { result: BreachCheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const visibleBreaches = expanded ? result.breaches : result.breaches.slice(0, 3);
  const hasMore = result.breaches.length > 3;

  return (
    <div
      className={cn(
        'rounded-card border p-4 text-sm',
        result.breached
          ? 'border-orange-300 bg-orange-50 dark:border-orange-700/60 dark:bg-orange-900/10'
          : 'border-green-300 bg-green-50 dark:border-green-700/60 dark:bg-green-900/10'
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Shield className="h-4 w-4" />
        Email Breach Check
      </div>
      <p className="mb-1 text-gray-600 dark:text-gray-400">
        Email: <span className="font-medium text-gray-800 dark:text-gray-200">{result.email}</span>
      </p>
      <p className="mb-3 flex items-center gap-1.5">
        {result.breached ? (
          <>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-orange-700 dark:text-orange-400">
              Found in {result.breach_count} breach{result.breach_count !== 1 ? 'es' : ''}
            </span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-green-700 dark:text-green-400">No breaches found</span>
          </>
        )}
      </p>

      {result.breaches.length > 0 && (
        <>
          <ul className="mb-2 space-y-1">
            {visibleBreaches.map((b) => (
              <li key={b.name} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className="mt-0.5 text-orange-400">•</span>
                <span>
                  <strong className="text-gray-800 dark:text-gray-200">{b.name}</strong>{' '}
                  ({b.breach_date.slice(0, 4)}) — {b.data_classes.join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:underline dark:text-accent"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show {result.breaches.length - 3} more</>
              )}
            </button>
          )}
        </>
      )}

      {result.advice && <AdviceBlock advice={result.advice} />}
    </div>
  );
}

// ─── URL Scan ────────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  safe: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'border-green-300 bg-green-50 dark:border-green-700/60 dark:bg-green-900/10',
    label: '✅ Safe',
  },
  suspicious: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'border-yellow-300 bg-yellow-50 dark:border-yellow-700/60 dark:bg-yellow-900/10',
    label: '⚠️ Suspicious',
  },
  malicious: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'border-red-300 bg-red-50 dark:border-red-700/60 dark:bg-red-900/10',
    label: '🚨 Malicious',
  },
};

function UrlCard({ result }: { result: UrlScanResult }) {
  const cfg = VERDICT_CONFIG[result.verdict];
  const heuristicWarnings =
    (result.details?.heuristic_warnings as Array<{ level: string; message: string }>) ?? [];
  const warns = heuristicWarnings.filter((w) => w.level === 'warn');

  return (
    <div className={cn('rounded-card border p-4 text-sm', cfg.bg)}>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Link2 className="h-4 w-4" />
        URL Safety Scan
      </div>
      <p className="mb-1 truncate text-gray-600 dark:text-gray-400">
        URL: <span className="font-medium text-gray-800 dark:text-gray-200">{result.url}</span>
      </p>
      <p className="mb-2 flex items-center gap-1.5">
        <cfg.icon className={cn('h-4 w-4', cfg.color)} />
        <span>
          {cfg.label}{' '}
          <span className="text-gray-500 dark:text-gray-400">
            ({result.positives}/{result.total_scanners} flagged)
          </span>
        </span>
      </p>

      {warns.length > 0 && (
        <ul className="mb-2 space-y-1">
          {warns.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {result.advice && <AdviceBlock advice={result.advice} />}
    </div>
  );
}

// ─── IP Check ────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low: {
    color: 'text-green-600 dark:text-green-400',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  high: {
    color: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  critical: {
    color: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

function IpCard({ result }: { result: IpCheckResult }) {
  const riskLevel: IpCheckResult['risk_level'] =
    result.risk_level ??
    (result.abuse_score <= 25
      ? 'low'
      : result.abuse_score <= 50
      ? 'medium'
      : result.abuse_score <= 75
      ? 'high'
      : 'critical');
  const cfg = RISK_CONFIG[riskLevel];

  return (
    <div className="rounded-card border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-dark-surface">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Globe className="h-4 w-4 text-accent" />
        IP Reputation Check
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-gray-600 dark:text-gray-400">
          IP: <span className="font-medium text-gray-800 dark:text-gray-200">{result.ip}</span>
        </p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            cfg.badge
          )}
        >
          {riskLevel}
        </span>
      </div>

      <p className="mb-1">
        Abuse Score:{' '}
        <span className={cn('font-semibold', cfg.color)}>{result.abuse_score}/100</span>
      </p>
      <p className="mb-1 text-gray-600 dark:text-gray-400">
        Country: {result.country} • ISP: {result.isp}
      </p>
      {result.usage_type && (
        <p className="mb-1 text-gray-500 dark:text-gray-400">Usage: {result.usage_type}</p>
      )}
      <p className="mb-2 text-gray-500 dark:text-gray-400">
        Reports: {result.total_reports.toLocaleString()} in last 90 days
        {result.last_reported && ` • Last: ${new Date(result.last_reported).toLocaleDateString()}`}
      </p>

      {(result.is_tor || (result.categories && result.categories.length > 0)) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {result.is_tor && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Tor Exit Node
            </span>
          )}
          {result.categories?.map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {result.advice && <AdviceBlock advice={result.advice} />}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

const ToolCard = (props: ToolCardProps) => {
  if (props.tool === 'breach_check') return <BreachCard result={props.result} />;
  if (props.tool === 'url_scan') return <UrlCard result={props.result} />;
  return <IpCard result={props.result} />;
};

export default ToolCard;
