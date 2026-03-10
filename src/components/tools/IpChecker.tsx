import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Loader2, MessageSquare } from 'lucide-react';
import { useTools } from '../../hooks/useTools';
import ToolCard from '../chat/ToolCard';
import type { IpCheckResult } from '../../types';

const IpChecker = () => {
  const [ip, setIp] = useState('');
  const [result, setResult] = useState<IpCheckResult | null>(null);
  const { checkIp, isLoading, error } = useTools();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const res = await checkIp(ip.trim());
    if (res) setResult(res);
  };

  const handleAskAI = () => {
    const risk = result?.risk_level ?? 'unknown';
    const prompt =
      risk === 'critical' || risk === 'high'
        ? `The IP address ${result?.ip} has a high abuse score of ${result?.abuse_score}/100 with ${result?.total_reports} reports. How do I protect myself or my server from this IP?`
        : `I checked the IP address ${result?.ip} and it has a low risk score. Can you explain what IP reputation means and how to stay safe?`;
    navigate('/chat', { state: { toolPrompt: prompt } });
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
          <Globe className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">IP Reputation Check</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check if an IP address has been reported for malicious activity
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 185.220.101.1"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-200 dark:placeholder:text-gray-500"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            disabled={isLoading || !ip.trim()}
            className="flex min-w-[80px] items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
          </button>
        </div>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Checking IP reputation database…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-900/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <ToolCard tool="ip_check" result={result} />
          <button
            onClick={handleAskAI}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:hover:bg-gray-800/60"
          >
            <MessageSquare className="h-4 w-4 text-accent" />
            Ask Tek-Safe AI for help
          </button>
        </div>
      )}

      {/* Info note */}
      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Powered by <span className="font-medium">AbuseIPDB</span>. Private/reserved IPs cannot be checked.
      </p>
    </div>
  );
};

export default IpChecker;
