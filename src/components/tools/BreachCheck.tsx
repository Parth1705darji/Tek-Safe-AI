import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Loader2, MessageSquare } from 'lucide-react';
import { useTools } from '../../hooks/useTools';
import ToolCard from '../chat/ToolCard';
import type { BreachCheckResult } from '../../types';

const BreachCheck = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<BreachCheckResult | null>(null);
  const { checkBreach, isLoading, error } = useTools();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const res = await checkBreach(email.trim());
    if (res) setResult(res);
  };

  const handleAskAI = () => {
    const prompt = result?.breached
      ? `My email ${result.email} was found in ${result.breach_count} data breach${result.breach_count > 1 ? 'es' : ''} including ${result.breaches
          .slice(0, 2)
          .map((b) => b.name)
          .join(' and ')}. What should I do to protect myself now?`
      : `I checked my email for data breaches and it came back clean. What other security steps should I take to stay protected?`;
    navigate('/chat', { state: { toolPrompt: prompt } });
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Email Breach Check</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check if your email has been exposed in known data breaches
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-200 dark:placeholder:text-gray-500"
              disabled={isLoading}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
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
          Checking against known data breaches…
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
          <ToolCard tool="breach_check" result={result} />
          <button
            onClick={handleAskAI}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:hover:bg-gray-800/60"
          >
            <MessageSquare className="h-4 w-4 text-accent" />
            Ask Tek-Safe AI for help
          </button>
        </div>
      )}

      {/* Privacy note */}
      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        We don't store or log your email address.{' '}
        <span className="font-medium">Powered by Have I Been Pwned.</span>
      </p>
    </div>
  );
};

export default BreachCheck;
